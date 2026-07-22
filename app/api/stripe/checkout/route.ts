import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCheckoutSession } from '@/lib/stripe'
import { requireApiSession } from '@/lib/apiAuth'
import { getRequestId, logApiEvent } from '@/lib/apiLogging'

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const auth = await requireApiSession()
  if (!auth.ok) return auth.error
  const session = auth.session

  const body = await req.json()
  const singleOrderId = typeof body.orderId === 'string' ? body.orderId : null
  const fromArray = Array.isArray(body.orderIds) ? body.orderIds.filter((id: unknown) => typeof id === 'string' && id.trim()) : []
  const requestedOrderIds = [...new Set([...(singleOrderId ? [singleOrderId] : []), ...fromArray])]

  if (requestedOrderIds.length === 0) {
    logApiEvent('warn', 'stripe.checkout.invalid_request', { requestId, actorRole: session.user.role })
    return NextResponse.json({ error: 'Select at least one order to pay.' }, { status: 400 })
  }

  logApiEvent('info', 'stripe.checkout.requested', {
    requestId,
    actorRole: session.user.role,
    actorId: session.user.id,
    orderCount: requestedOrderIds.length,
  })

  const orders = await prisma.order.findMany({
    where: { id: { in: requestedOrderIds } },
    include: {
      medication: true,
      orderMedications: { include: { medication: true } },
      patient: { include: { user: true } },
    },
  })

  if (orders.length !== requestedOrderIds.length) {
    logApiEvent('warn', 'stripe.checkout.order_not_found', { requestId, requested: requestedOrderIds.length, found: orders.length })
    return NextResponse.json({ error: 'One or more selected orders were not found.' }, { status: 404 })
  }

  const isAdmin = session.user.role === 'MASTER_ADMIN'
  const patientUserId = orders[0]?.patient?.userId ?? null
  const allSamePatient = orders.every((order) => order.patient?.userId === patientUserId)
  if (!allSamePatient) {
    logApiEvent('warn', 'stripe.checkout.multi_patient_blocked', { requestId, orderCount: requestedOrderIds.length })
    return NextResponse.json({ error: 'Selected orders must belong to the same patient.' }, { status: 400 })
  }

  const isPatientOwner = session.user.role === 'PATIENT' && patientUserId === session.user.id
  if (!isAdmin && !isPatientOwner) {
    logApiEvent('warn', 'stripe.checkout.forbidden', { requestId, actorRole: session.user.role, actorId: session.user.id })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  for (const order of orders) {
    if (order.status !== 'PRESCRIBED') {
      return NextResponse.json({ error: 'Payment is only available for prescribed orders.' }, { status: 400 })
    }
    if (order.amountPaid != null || order.paymentState === 'PAID') {
      return NextResponse.json({ error: 'One or more selected orders are already paid.' }, { status: 400 })
    }
    if (order.paymentState === 'REFUNDED' || order.paymentState === 'VOIDED') {
      return NextResponse.json({ error: 'One or more selected orders are locked. Please contact support.' }, { status: 400 })
    }
  }

  const items: Array<{ name: string; description: string; amount: number; quantity: number }> = []
  for (const order of orders) {
    const orderItems = order.orderMedications.length > 0
      ? order.orderMedications.map(item => ({
          name: `${item.medication.name} (${order.orderNumber ?? order.id.slice(0, 5).toUpperCase()})`,
          description: item.medication.directions ?? 'One-time prescription program payment',
          amount: item.medication.price,
          quantity: 1,
        }))
      : order.medication
        ? [{
            name: `${order.medication.name} (${order.orderNumber ?? order.id.slice(0, 5).toUpperCase()})`,
            description: order.medication.directions ?? 'One-time prescription program payment',
            amount: order.medication.price,
            quantity: 1,
          }]
        : []

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'Provider has not selected final medication for one or more orders.' }, { status: 400 })
    }
    items.push(...orderItems)
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const primaryOrderId = requestedOrderIds[0]
  const serializedOrderIds = requestedOrderIds.join(',')

  const checkoutSession = await createCheckoutSession({
    patientEmail: orders[0].patient.user.email,
    patientName: orders[0].patient.user.name,
    orderId: primaryOrderId,
    metadata: { orderIds: serializedOrderIds },
    lineItems: items,
    successUrl: `${baseUrl}/payment/success?orderIds=${encodeURIComponent(serializedOrderIds)}`,
    cancelUrl: `${baseUrl}/payment?orderId=${primaryOrderId}`,
  })

  logApiEvent('info', 'stripe.checkout.created', {
    requestId,
    actorRole: session.user.role,
    orderCount: requestedOrderIds.length,
    paymentIntentSession: checkoutSession.id,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
