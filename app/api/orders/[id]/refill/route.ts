export const dynamic = 'force-dynamic'















import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/orderNumber'
import {
  decrementRefill,
  discontinueExpiredPrescription,
  isPrescriptionExpired,
  parsePrescriptionMeta,
  upsertPrescriptionMeta,
} from '@/lib/prescriptionMeta'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const isAdmin = session.user.role === 'MASTER_ADMIN'
  const isPatient = session.user.role === 'PATIENT'
  if (!isAdmin && !isPatient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sourceOrder = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      patient: true,
      orderMedications: { select: { medicationId: true } },
    },
  })

  if (!sourceOrder) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (!isAdmin && sourceOrder.patient.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['SHIPPED', 'COMPLETED'].includes(sourceOrder.status)) {
    return NextResponse.json({ error: 'Refills can only be requested for shipped/completed orders.' }, { status: 400 })
  }

  const sourceMeta = parsePrescriptionMeta(sourceOrder.notes)
  if (!sourceMeta) {
    return NextResponse.json({ error: 'Refill metadata is missing for this prescription. Please contact support.' }, { status: 400 })
  }

  if (isPrescriptionExpired(sourceMeta)) {
    const expiredMeta = discontinueExpiredPrescription(sourceMeta)
    await prisma.order.update({
      where: { id: sourceOrder.id },
      data: {
        status: 'CANCELLED',
        notes: upsertPrescriptionMeta(sourceOrder.notes, expiredMeta),
      },
    })
    return NextResponse.json({ error: 'Refills are expired for this prescription.' }, { status: 400 })
  }

  if (sourceMeta.refillsRemaining <= 0) {
    return NextResponse.json({ error: 'No refills remaining on this prescription.' }, { status: 400 })
  }

  const existingOpenRefill = await prisma.order.findFirst({
    where: {
      patientId: sourceOrder.patientId,
      notes: { contains: `REFILL_OF:${sourceOrder.id}` },
      status: { in: ['REFILL_REQUESTED', 'PRESCRIBED', 'PHARMACY_PENDING', 'SHIPPED'] },
    },
    select: { id: true, status: true },
  })

  if (existingOpenRefill) {
    return NextResponse.json(
      { error: `A refill request already exists for this order (${existingOpenRefill.status}).` },
      { status: 409 }
    )
  }

  const medicationIds = sourceOrder.orderMedications.length > 0
    ? sourceOrder.orderMedications.map((m) => m.medicationId)
    : sourceOrder.medicationId
      ? [sourceOrder.medicationId]
      : []

  if (medicationIds.length === 0) {
    return NextResponse.json({ error: 'No refillable medication found on this order.' }, { status: 400 })
  }

  const refillNote = `REFILL_OF:${sourceOrder.id};REQUESTED_AT:${new Date().toISOString()}`

  const createBaseData = {
    status: 'REFILL_REQUESTED',
    patientId: sourceOrder.patientId,
    medicationId: medicationIds[0],
    providerId: sourceOrder.providerId,
    pharmacyId: sourceOrder.pharmacyId,
    influencerId: sourceOrder.influencerId,
    paymentState: 'UNPAID',
    notes: refillNote,
    orderMedications: {
      create: medicationIds.map((medicationId) => ({ medicationId })),
    },
  }

  const decrementedMeta = decrementRefill(sourceMeta)

  const refillOrder = await prisma.$transaction(async (tx) => {
    let created
    try {
      const orderNumber = await generateOrderNumber()
      created = await tx.order.create({
        data: {
          ...createBaseData,
          orderNumber,
        },
        select: { id: true, status: true, orderNumber: true },
      })
    } catch {
      created = await tx.order.create({
        data: createBaseData,
        select: { id: true, status: true, orderNumber: true },
      })
    }

    await tx.order.update({
      where: { id: sourceOrder.id },
      data: {
        notes: upsertPrescriptionMeta(sourceOrder.notes, decrementedMeta),
      },
    })

    return created
  })

  return NextResponse.json({
    message: `Refill request sent to pharmacy queue. Refills remaining: ${decrementedMeta.refillsRemaining}.`,
    orderId: refillOrder.id,
    status: refillOrder.status,
    refillsRemaining: decrementedMeta.refillsRemaining,
  })
}
