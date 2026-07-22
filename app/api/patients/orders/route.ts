export const dynamic = 'force-dynamic'










import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureOrderNumberForOrder } from '@/lib/orderNumber'
import { getOrderRef } from '@/lib/orderRef'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    include: {
      orders: {
        where: {
          paymentState: {
            not: 'VOIDED',
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          medication: true,
          provider: { include: { user: { select: { name: true } } } },
          pharmacy: { include: { user: { select: { name: true } } } },
        },
      },
    },
  })

  const orders = patient?.orders ?? []
  for (const order of orders) {
    if (!order.orderNumber) {
      try {
        order.orderNumber = await ensureOrderNumberForOrder(order.id)
      } catch {
        order.orderNumber = getOrderRef(null, order.id)
      }
    }
  }

  return NextResponse.json(orders)
}
