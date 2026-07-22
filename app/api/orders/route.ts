import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureOrderNumberForOrder } from '@/lib/orderNumber'
import { generateOrderNumber } from '@/lib/orderNumber'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const status = searchParams.get('status')

  let where: Record<string, unknown> = {}

  if (session.user.role === 'PROVIDER') {
    const provider = await prisma.provider.findUnique({ where: { userId: session.user.id } })
    where = { providerId: provider?.id }
  } else if (session.user.role === 'PHARMACY') {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: session.user.id } })
    where = { pharmacyId: pharmacy?.id }
  } else if (session.user.role === 'INFLUENCER') {
    const influencer = await prisma.influencer.findUnique({ where: { userId: session.user.id } })
    where = { influencerId: influencer?.id }
  }
  // MASTER_ADMIN sees all

  if (!['MASTER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    where.paymentState = { not: 'VOIDED' }
  }

  if (status) where.status = status

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      medication: { select: { id: true, name: true, price: true } },
      orderMedications: {
        include: { medication: { select: { id: true, name: true, price: true } } },
      },
      patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
      provider: { include: { user: { select: { name: true } } } },
      pharmacy: { include: { user: { select: { name: true } } } },
      influencer: { include: { user: { select: { name: true } } } },
    },
  })

  for (const order of orders) {
    if (!order.orderNumber) {
      order.orderNumber = await ensureOrderNumberForOrder(order.id)
    }
  }

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['PROVIDER', 'PHARMACY', 'ADMIN', 'MASTER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const patientId = typeof body.patientId === 'string' ? body.patientId : null
    const providerNotes = typeof body.providerNotes === 'string' ? body.providerNotes.trim() : null
    const rxNumber = typeof body.rxNumber === 'string' ? body.rxNumber.trim() : null
    const rawMedicationIds: string[] = Array.isArray(body.medicationIds)
      ? body.medicationIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
    const medicationIds: string[] = Array.from(new Set<string>(rawMedicationIds)).slice(0, 2)

    if (!patientId) {
      return NextResponse.json({ error: 'Patient is required.' }, { status: 400 })
    }

    if (medicationIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one medication.' }, { status: 400 })
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 })
    }

    const validMeds = await prisma.medication.findMany({
      where: {
        id: { in: medicationIds },
        isActive: true,
      },
      select: { id: true },
    })

    if (validMeds.length !== medicationIds.length) {
      return NextResponse.json({ error: 'One or more selected medications are invalid or inactive.' }, { status: 400 })
    }

    let providerId: string | null = null
    let pharmacyId: string | null = null

    if (session.user.role === 'PROVIDER') {
      const provider = await prisma.provider.findUnique({ where: { userId: session.user.id } })
      if (!provider) return NextResponse.json({ error: 'Provider profile not found.' }, { status: 400 })
      providerId = provider.id
      const pharmacy = await prisma.pharmacy.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
      pharmacyId = pharmacy?.id ?? null
    } else if (session.user.role === 'PHARMACY') {
      const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: session.user.id } })
      if (!pharmacy) return NextResponse.json({ error: 'Pharmacy profile not found.' }, { status: 400 })
      pharmacyId = pharmacy.id
      const provider = await prisma.provider.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
      providerId = provider?.id ?? null
    } else {
      const provider = await prisma.provider.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
      const pharmacy = await prisma.pharmacy.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
      providerId = provider?.id ?? null
      pharmacyId = pharmacy?.id ?? null
    }

    if (!providerId || !pharmacyId) {
      return NextResponse.json({ error: 'Active provider and pharmacy are required to create an order.' }, { status: 400 })
    }

    const createOrder = async (includeOrderNumber: boolean) => {
      const orderData: Prisma.OrderCreateInput = {
        status: 'PRESCRIBED',
        patient: { connect: { id: patientId } },
        provider: { connect: { id: providerId } },
        pharmacy: { connect: { id: pharmacyId } },
        medication: { connect: { id: medicationIds[0] } },
        providerNotes: providerNotes || null,
        rxNumber: rxNumber || null,
        paymentState: 'UNPAID',
        orderMedications: {
          create: medicationIds.map((medicationId) => ({ medicationId })),
        },
      }
      if (includeOrderNumber) {
        orderData.orderNumber = await generateOrderNumber()
      }

      return prisma.order.create({
        data: orderData,
        include: {
          medication: { select: { id: true, name: true, price: true } },
          orderMedications: {
            include: { medication: { select: { id: true, name: true, price: true } } },
          },
          patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
          provider: { include: { user: { select: { name: true } } } },
          pharmacy: { include: { user: { select: { name: true } } } },
          influencer: { include: { user: { select: { name: true } } } },
        },
      })
    }

    let order
    try {
      order = await createOrder(true)
    } catch (primaryErr) {
      console.error('Order create with orderNumber failed; retrying without orderNumber', primaryErr)
      order = await createOrder(false)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error('Order creation failed', err)
    return NextResponse.json({ error: 'Could not create order right now. Please try again.' }, { status: 500 })
  }
}
