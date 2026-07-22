import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureOrderNumberForOrder } from '@/lib/orderNumber'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      medication: { select: { name: true, price: true, directions: true } },
      orderMedications: { include: { medication: { select: { name: true, price: true, directions: true, quantity: true } } } },
      patient: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = ['MASTER_ADMIN', 'ADMIN'].includes(session.user.role)
  const isPatientOwner = session.user.role === 'PATIENT' && order.patient.user.id === session.user.id
  const canAccess = isAdmin || isPatientOwner
  if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!order.orderNumber) {
    order.orderNumber = await ensureOrderNumberForOrder(order.id)
  }

  return NextResponse.json(order)
}
