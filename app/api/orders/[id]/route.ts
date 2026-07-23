export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPaymentRequiredSms } from '@/lib/notifications'
import { ensureOrderNumberForOrder } from '@/lib/orderNumber'
import { requireApiRole, requireApiSession } from '@/lib/apiAuth'
import { getRequestId, logApiEvent } from '@/lib/apiLogging'
import { writeAuditLog } from '@/lib/auditLog'
import { createPrescriptionMeta, parsePrescriptionMeta, upsertPrescriptionMeta } from '@/lib/prescriptionMeta'

type AllowedStatus =
  | 'INTAKE_PENDING'
  | 'PROVIDER_REVIEW'
  | 'REFILL_REQUESTED'
  | 'PRESCRIBED'
  | 'PHARMACY_PENDING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'

type PaymentState = 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOIDED'

const VALID_STATUSES: AllowedStatus[] = [
  'INTAKE_PENDING',
  'PROVIDER_REVIEW',
  'REFILL_REQUESTED',
  'PRESCRIBED',
  'PHARMACY_PENDING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
]

const VALID_PAYMENT_STATES: PaymentState[] = ['UNPAID', 'PAID', 'REFUNDED', 'VOIDED']
const CRITICAL_STATUSES: AllowedStatus[] = ['PHARMACY_PENDING', 'SHIPPED', 'COMPLETED', 'CANCELLED']

function isValidStatus(value: unknown): value is AllowedStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as AllowedStatus)
}

function isValidPaymentState(value: unknown): value is PaymentState {
  return typeof value === 'string' && VALID_PAYMENT_STATES.includes(value as PaymentState)
}

function canProviderStandardTransition(from: string, to: AllowedStatus) {
  return (
    (from === 'INTAKE_PENDING' && to === 'PROVIDER_REVIEW') ||
    (from === 'INTAKE_PENDING' && to === 'PRESCRIBED') ||
    (from === 'PROVIDER_REVIEW' && to === 'PRESCRIBED')
  )
}

function canPharmacyTransition(from: string, to: AllowedStatus) {
  return (
    (from === 'REFILL_REQUESTED' && to === 'PRESCRIBED') ||
    (from === 'PRESCRIBED' && to === 'PHARMACY_PENDING') ||
    (from === 'PHARMACY_PENDING' && to === 'PRESCRIBED') ||
    (from === 'PRESCRIBED' && to === 'SHIPPED') ||
    (from === 'PHARMACY_PENDING' && to === 'SHIPPED') ||
    (from === 'SHIPPED' && to === 'COMPLETED')
  )
}

function isCriticalStatus(status: AllowedStatus) {
  return CRITICAL_STATUSES.includes(status)
}

function isUnsupportedNoteFieldError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('patientNotes') ||
    message.includes('pharmacyNotes') ||
    message.includes('Unknown argument') ||
    message.includes('no such column')
  )
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = getRequestId(req)
  const auth = await requireApiSession()
  if (!auth.ok) return auth.error
  const session = auth.session

  logApiEvent('info', 'orders.detail.requested', {
    requestId,
    orderId: params.id,
    actorRole: session.user.role,
    actorId: session.user.id,
  })

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      medication: true,
      orderMedications: { include: { medication: true } },
      patient: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      provider: { include: { user: { select: { id: true, name: true } } } },
      pharmacy: { include: { user: { select: { id: true, name: true } } } },
      influencer: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = ['MASTER_ADMIN', 'ADMIN'].includes(session.user.role)
  const isPatientOwner = session.user.role === 'PATIENT' && order.patient?.user?.id === session.user.id
  const isAssignedProvider = session.user.role === 'PROVIDER' && order.provider?.user?.id === session.user.id
  const isAssignedPharmacy = session.user.role === 'PHARMACY' && order.pharmacy?.user?.id === session.user.id
  const isAssignedInfluencer = session.user.role === 'INFLUENCER' && order.influencer?.user?.id === session.user.id

  if (!isAdmin && !isPatientOwner && !isAssignedProvider && !isAssignedPharmacy && !isAssignedInfluencer) {
    logApiEvent('warn', 'orders.detail.forbidden', { requestId, orderId: params.id, actorRole: session.user.role, actorId: session.user.id })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!order.orderNumber) {
    order.orderNumber = await ensureOrderNumberForOrder(order.id)
  }

  logApiEvent('info', 'orders.detail.loaded', { requestId, orderId: params.id, status: order.status })

  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = getRequestId(req)
  const auth = await requireApiRole(['MASTER_ADMIN', 'ADMIN', 'PROVIDER', 'PHARMACY'])
  if (!auth.ok) return auth.error
  const session = auth.session

  logApiEvent('info', 'orders.update.requested', {
    requestId,
    orderId: params.id,
    actorRole: session.user.role,
    actorId: session.user.id,
  })

  const existing = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      provider: { include: { user: { select: { id: true } } } },
      pharmacy: { include: { user: { select: { id: true } } } },
      patient: { include: { user: { select: { name: true, phone: true } } } },
      orderMedications: { select: { medicationId: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isMasterAdmin = session.user.role === 'MASTER_ADMIN'
  const isDailyAdmin = session.user.role === 'ADMIN'
  const isProvider = session.user.role === 'PROVIDER'
  const isPharmacy = session.user.role === 'PHARMACY'

  if (isProvider && existing.provider?.user?.id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (isPharmacy && existing.pharmacy?.user?.id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const rawFinalMedicationIds = Array.isArray(body.finalMedicationIds)
    ? body.finalMedicationIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : null
  const finalMedicationIds = rawFinalMedicationIds ? Array.from(new Set<string>(rawFinalMedicationIds)).slice(0, 2) : null

  const isOverride = typeof body.overrideStatus === 'string'
  const requestedStatus = isOverride ? body.overrideStatus : body.status
  const overrideReason = typeof body.overrideReason === 'string' ? body.overrideReason.trim() : ''
  const paymentStateInput = body.paymentState
  const paymentStateReason = typeof body.paymentStateReason === 'string' ? body.paymentStateReason.trim() : ''
  const providerIdInput = typeof body.providerId === 'string' ? body.providerId.trim() : null
  const pharmacyIdInput = typeof body.pharmacyId === 'string' ? body.pharmacyId.trim() : null
  const prescriptionQuantityInput = typeof body.prescriptionQuantity === 'string' ? body.prescriptionQuantity.trim() : null
  const prescriptionRefillsInput = Number(body.prescriptionRefills)
  const prescriptionWrittenDateInput = typeof body.prescriptionWrittenDate === 'string' ? body.prescriptionWrittenDate.trim() : null

  let nextStatus: AllowedStatus | null = null
  if (requestedStatus != null) {
    if (!isValidStatus(requestedStatus)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 })
    }
    nextStatus = requestedStatus
  }

  let nextPaymentState: PaymentState | null = null
  if (paymentStateInput != null) {
    if (!isValidPaymentState(paymentStateInput)) {
      return NextResponse.json({ error: 'Invalid payment state.' }, { status: 400 })
    }
    nextPaymentState = paymentStateInput
  }

  const effectivePaymentState = nextPaymentState ?? (existing.paymentState as PaymentState)

  if (isPharmacy && finalMedicationIds) {
    return NextResponse.json({ error: 'Only provider/admin can select final medications.' }, { status: 403 })
  }

  if (finalMedicationIds && finalMedicationIds.length > 0 && isPharmacy) {
    return NextResponse.json({ error: 'Pharmacy cannot alter medication selection.' }, { status: 403 })
  }

  if (isOverride) {
    if (!isMasterAdmin && !isDailyAdmin && !isProvider) {
      return NextResponse.json({ error: 'Only provider/admin can override status.' }, { status: 403 })
    }
    if (!nextStatus) {
      return NextResponse.json({ error: 'Override status is required.' }, { status: 400 })
    }
    if (overrideReason.length < 8) {
      return NextResponse.json({ error: 'Override reason is required (min 8 chars).' }, { status: 400 })
    }

    // Daily admin can complete paid orders; all other critical overrides require Master Admin.
    if ((isCriticalStatus(existing.status as AllowedStatus) || isCriticalStatus(nextStatus)) && !isMasterAdmin) {
      const allowDailyAdminPaidCompletion =
        isDailyAdmin &&
        nextStatus === 'COMPLETED' &&
        effectivePaymentState === 'PAID'

      if (!allowDailyAdminPaidCompletion) {
        return NextResponse.json({ error: 'Critical status overrides require Master Admin.' }, { status: 403 })
      }
    }

    // Provider can unprescribe only when order is unpaid.
    if (isProvider && existing.status === 'PRESCRIBED' && nextStatus === 'PROVIDER_REVIEW') {
      const hasCapturedPayment = (existing.amountPaid ?? 0) > 0 || existing.paidAt != null
      if (existing.paymentState !== 'UNPAID' || hasCapturedPayment) {
        return NextResponse.json(
          {
            error: `This prescription has payment activity (state=${existing.paymentState}, amountPaid=${existing.amountPaid ?? 0}). Please request admin correction.`,
          },
          { status: 403 }
        )
      }
    }

    if (isProvider && existing.status === 'PRESCRIBED' && nextStatus !== 'PROVIDER_REVIEW' && nextStatus !== 'PRESCRIBED') {
      return NextResponse.json({ error: 'Provider can only revert prescribed orders to Provider Review when unpaid.' }, { status: 403 })
    }
  } else if (nextStatus) {
    if (isProvider && !isMasterAdmin && !canProviderStandardTransition(existing.status, nextStatus)) {
      return NextResponse.json({ error: 'Provider transition not allowed. Use override with reason.' }, { status: 400 })
    }

    if (isPharmacy && !canPharmacyTransition(existing.status, nextStatus)) {
      return NextResponse.json({ error: 'Pharmacy transition not allowed.' }, { status: 400 })
    }

    if (isDailyAdmin && isCriticalStatus(nextStatus)) {
      const allowDailyAdminPaidCompletion = nextStatus === 'COMPLETED' && effectivePaymentState === 'PAID'
      if (!allowDailyAdminPaidCompletion) {
        return NextResponse.json({ error: 'Daily Admin cannot set critical fulfillment statuses.' }, { status: 403 })
      }
    }
  }

  if (nextPaymentState) {
    if (!isMasterAdmin && !isDailyAdmin) {
      return NextResponse.json({ error: 'Only admins can update payment state.' }, { status: 403 })
    }
    if (nextPaymentState !== existing.paymentState && paymentStateReason.length < 8) {
      return NextResponse.json({ error: 'Payment state reason is required (min 8 chars).' }, { status: 400 })
    }
    if ((nextPaymentState === 'REFUNDED' || nextPaymentState === 'VOIDED') && !isMasterAdmin) {
      return NextResponse.json({ error: 'Refund/void state changes require Master Admin.' }, { status: 403 })
    }
  }

  if ((providerIdInput || pharmacyIdInput) && !isMasterAdmin && !isDailyAdmin) {
    return NextResponse.json({ error: 'Only admins can reassign provider or pharmacy.' }, { status: 403 })
  }

  if (providerIdInput) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerIdInput, isActive: true },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Selected provider is invalid or inactive.' }, { status: 400 })
    }
  }

  if (pharmacyIdInput) {
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id: pharmacyIdInput, isActive: true },
      select: { id: true },
    })
    if (!pharmacy) {
      return NextResponse.json({ error: 'Selected pharmacy is invalid or inactive.' }, { status: 400 })
    }
  }

  // Shipping lock: only paid orders can move to shipped/completed.
  if ((nextStatus === 'SHIPPED' || nextStatus === 'COMPLETED') && effectivePaymentState !== 'PAID') {
    return NextResponse.json({ error: 'Must be paid before shipping.' }, { status: 400 })
  }

  if (finalMedicationIds && finalMedicationIds.length > 0) {
    const count = await prisma.medication.count({
      where: {
        id: { in: finalMedicationIds },
        isActive: true,
      },
    })
    if (count !== finalMedicationIds.length) {
      return NextResponse.json({ error: 'One or more selected medications are invalid or inactive.' }, { status: 400 })
    }
  }

  const selectedMedicationIds = finalMedicationIds ?? existing.orderMedications.map((item) => item.medicationId)
  if (nextStatus === 'PRESCRIBED' && selectedMedicationIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one final medication before prescribing.' }, { status: 400 })
  }

  const updatableScalarFields = ['providerNotes', 'patientNotes', 'pharmacyNotes', 'rxNumber', 'trackingNumber', 'notes']
  const updateData: Record<string, unknown> = {}
  for (const key of updatableScalarFields) {
    if (key in body) updateData[key] = body[key]
  }
  if (nextStatus) updateData.status = nextStatus
  if (providerIdInput) updateData.providerId = providerIdInput
  if (pharmacyIdInput) updateData.pharmacyId = pharmacyIdInput
  if (nextPaymentState) {
    updateData.paymentState = nextPaymentState
    updateData.paymentStateReason = paymentStateReason || null
  }
  if (finalMedicationIds && finalMedicationIds.length > 0) updateData.medicationId = finalMedicationIds[0]

  const fallbackMedication = await prisma.medication.findFirst({
    where: { id: selectedMedicationIds[0] },
    select: { quantity: true },
  })
  const priorMeta = parsePrescriptionMeta(existing.notes)
  const effectiveQuantity = prescriptionQuantityInput ?? priorMeta?.quantity ?? fallbackMedication?.quantity ?? ''
  const effectiveRefills = Number.isFinite(prescriptionRefillsInput)
    ? Math.max(0, Math.min(99, Math.floor(prescriptionRefillsInput)))
    : (priorMeta?.refillsRemaining ?? 0)
  const shouldSetPrescriptionMeta =
    nextStatus === 'PRESCRIBED' &&
    (
      existing.status !== 'PRESCRIBED' ||
      prescriptionQuantityInput != null ||
      Number.isFinite(prescriptionRefillsInput) ||
      prescriptionWrittenDateInput != null
    )

  if (shouldSetPrescriptionMeta) {
    const nextMeta = createPrescriptionMeta({
      quantity: effectiveQuantity,
      refillCount: effectiveRefills,
      prescribedAt: priorMeta?.prescribedAt ?? new Date().toISOString(),
      writtenDate: prescriptionWrittenDateInput ?? priorMeta?.writtenDate ?? undefined,
    })
    updateData.notes = upsertPrescriptionMeta((typeof updateData.notes === 'string' ? updateData.notes : existing.notes) ?? null, nextMeta)
  }

  const beforeSnapshot = JSON.stringify({
    status: existing.status,
    medicationId: existing.medicationId,
    providerId: existing.providerId,
    pharmacyId: existing.pharmacyId,
    providerNotes: existing.providerNotes,
    patientNotes: existing.patientNotes,
    pharmacyNotes: existing.pharmacyNotes,
    notes: existing.notes,
    amountPaid: existing.amountPaid,
    paidAt: existing.paidAt,
    paymentState: existing.paymentState,
    paymentStateReason: existing.paymentStateReason,
    trackingNumber: existing.trackingNumber,
  })

  const runUpdateTransaction = async (dataForUpdate: Record<string, unknown>) => {
    return prisma.$transaction(async (tx) => {
      if (finalMedicationIds && finalMedicationIds.length > 0) {
        await tx.orderMedication.deleteMany({ where: { orderId: params.id } })
        await tx.orderMedication.createMany({
          data: finalMedicationIds.map((medicationId: string) => ({ orderId: params.id, medicationId })),
        })
      }

      const order = await tx.order.update({
        where: { id: params.id },
        data: dataForUpdate,
      })

      await writeAuditLog(tx, {
        action: isOverride ? 'ORDER_STATUS_OVERRIDE' : nextPaymentState ? 'PAYMENT_STATE_UPDATE' : 'ORDER_UPDATE',
        entityType: 'ORDER',
        entityId: params.id,
        orderId: params.id,
        actorId: session.user.id,
        actorRole: session.user.role,
        reason: overrideReason || paymentStateReason || null,
        beforeValue: beforeSnapshot,
        afterValue: JSON.stringify({
          status: order.status,
          medicationId: order.medicationId,
          providerId: order.providerId,
          pharmacyId: order.pharmacyId,
          providerNotes: order.providerNotes,
          patientNotes: order.patientNotes,
          pharmacyNotes: order.pharmacyNotes,
          notes: order.notes,
          amountPaid: order.amountPaid,
          paidAt: order.paidAt,
          paymentState: order.paymentState,
          paymentStateReason: order.paymentStateReason,
          trackingNumber: order.trackingNumber,
        }),
        metadata: {
          requestId,
          updatedFields: Object.keys(dataForUpdate),
          finalMedicationIds: finalMedicationIds ?? null,
        },
      })

      return order
    })
  }

  let updated
  try {
    updated = await runUpdateTransaction(updateData)
  } catch (err) {
    if (!isUnsupportedNoteFieldError(err)) throw err

    // Graceful fallback for environments where the new note columns are not yet migrated.
    const legacyUpdateData = { ...updateData }
    delete legacyUpdateData.patientNotes
    delete legacyUpdateData.pharmacyNotes
    updated = await runUpdateTransaction(legacyUpdateData)
  }

  if (nextStatus === 'PRESCRIBED' && existing.status !== 'PRESCRIBED') {
    const phone = existing.patient?.user?.phone
    if (phone) {
      const firstName = existing.patient.user.name?.split(' ')[0] ?? 'there'
      try {
        await sendPaymentRequiredSms({ phone, firstName, orderId: params.id })
      } catch (err) {
        console.error('Failed to send payment-required SMS', err)
      }
    }
  }

  if (!updated.orderNumber) {
    updated.orderNumber = await ensureOrderNumberForOrder(updated.id)
  }

  logApiEvent('info', 'orders.update.completed', {
    requestId,
    orderId: params.id,
    actorRole: session.user.role,
    status: updated.status,
    paymentState: updated.paymentState,
  })

  return NextResponse.json(updated)
}
