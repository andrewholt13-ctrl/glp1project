import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/orderNumber'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'PATIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const medicationIds = Array.isArray(body?.medicationIds)
    ? [...new Set(body.medicationIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim()))].slice(0, 2)
    : []

  if (medicationIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one medication.' }, { status: 400 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          providerId: true,
          pharmacyId: true,
          influencerId: true,
        },
      },
    },
  })

  if (!patient) {
    return NextResponse.json({ error: 'Patient profile not found.' }, { status: 404 })
  }

  const validMedicationCount = await prisma.medication.count({
    where: { id: { in: medicationIds }, isActive: true },
  })
  if (validMedicationCount !== medicationIds.length) {
    return NextResponse.json({ error: 'One or more selected medications are invalid or inactive.' }, { status: 400 })
  }

  const fallbackProvider = await prisma.provider.findFirst({ where: { isActive: true }, select: { id: true } })
  const fallbackPharmacy = await prisma.pharmacy.findFirst({ where: { isActive: true }, select: { id: true } })
  const latestOrder = patient.orders[0]

  const baseData = {
    status: 'INTAKE_PENDING',
    patientId: patient.id,
    medicationId: null,
    providerId: latestOrder?.providerId ?? fallbackProvider?.id ?? null,
    pharmacyId: latestOrder?.pharmacyId ?? fallbackPharmacy?.id ?? null,
    influencerId: latestOrder?.influencerId ?? null,
    paymentState: 'UNPAID',
    notes: `RESELECT_AFTER_VOIDED:${new Date().toISOString()}`,
    orderMedications: {
      create: medicationIds.map((medicationId) => ({ medicationId })),
    },
  }

  let order
  try {
    const orderNumber = await generateOrderNumber()
    order = await prisma.order.create({ data: { ...baseData, orderNumber } })
  } catch {
    order = await prisma.order.create({ data: baseData })
  }

  return NextResponse.json({ orderId: order.id, status: order.status })
}
