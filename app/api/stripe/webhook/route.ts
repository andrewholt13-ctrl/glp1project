export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { getRequestId, logApiEvent } from '@/lib/apiLogging'
import { writeAuditLog } from '@/lib/auditLog'

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    logApiEvent('warn', 'stripe.webhook.invalid_signature', { requestId })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  logApiEvent('info', 'stripe.webhook.received', { requestId, eventType: event.type, eventId: event.id })

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const rawOrderIds = session.metadata?.orderIds
    const orderIds = rawOrderIds
      ? rawOrderIds.split(',').map((id) => id.trim()).filter(Boolean)
      : session.metadata?.orderId
        ? [session.metadata.orderId]
        : []

    if (orderIds.length > 0) {
      logApiEvent('info', 'stripe.webhook.checkout_completed', { requestId, eventId: event.id, orderCount: orderIds.length })
      const existingOrders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          medication: true,
          orderMedications: { include: { medication: true } },
        },
      })

      const existingById = new Map(existingOrders.map((order) => [order.id, order]))
      const paidAt = new Date()

      await prisma.$transaction(async (tx) => {
        let updatedCount = 0
        for (const orderId of orderIds) {
          const existing = existingById.get(orderId)
          if (!existing || existing.amountPaid != null || existing.status !== 'PRESCRIBED') continue

          const paidAmount = existing.orderMedications.length > 0
            ? existing.orderMedications.reduce((sum, item) => sum + item.medication.price, 0)
            : existing.medication?.price ?? 0

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: 'PHARMACY_PENDING',
              amountPaid: paidAmount,
              paidAt,
              paymentState: 'PAID',
              stripePaymentIntentId: session.payment_intent as string,
            },
          })

          await writeAuditLog(tx, {
            action: 'PAYMENT_COMPLETED',
            entityType: 'ORDER',
            entityId: orderId,
            orderId,
            actorRole: 'SYSTEM',
            beforeValue: JSON.stringify({ status: existing.status, amountPaid: existing.amountPaid, paidAt: existing.paidAt, paymentState: existing.paymentState }),
            afterValue: JSON.stringify({ status: 'PHARMACY_PENDING', amountPaid: paidAmount, paidAt, paymentState: 'PAID' }),
            metadata: { source: 'stripe.webhook', stripeEventId: event.id, paidOrderIds: orderIds, requestId },
          })
          updatedCount += 1
        }

        logApiEvent('info', 'stripe.webhook.orders_marked_paid', {
          requestId,
          eventId: event.id,
          requestedOrderCount: orderIds.length,
          updatedOrderCount: updatedCount,
        })
      })
    }
  }

  return NextResponse.json({ received: true })
}
