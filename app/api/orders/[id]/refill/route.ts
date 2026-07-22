import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/orderNumber'

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

  let refillOrder
  try {
    const orderNumber = await generateOrderNumber()
    refillOrder = await prisma.order.create({
      data: {
        ...createBaseData,
        orderNumber,
      },
      select: { id: true, status: true, orderNumber: true },
    })
  } catch {
    refillOrder = await prisma.order.create({
      data: createBaseData,
      select: { id: true, status: true },
    })
  }

  return NextResponse.json({
    message: 'Refill request sent to pharmacy queue.',
    orderId: refillOrder.id,
    status: refillOrder.status,
  })
}
