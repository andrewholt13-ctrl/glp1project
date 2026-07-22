export const dynamic = 'force-dynamic'










import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureOrderNumberForOrder } from '@/lib/orderNumber'

async function generateTicketCode() {
  for (let i = 0; i < 20; i++) {
    const candidate = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    const existing = await prisma.supportTicket.findUnique({ where: { ticketNumber: candidate }, select: { id: true } })
    if (!existing) return candidate
  }
  return String(Date.now() % 1000000).padStart(6, '0')
}

export async function POST(request: Request) {
  const body = await request.json()
  const { type, name, email, subject, message, orderId, orderNumber } = body
  if (!type || !name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const createdById = session?.user?.id || null
  const ticketNumber = await generateTicketCode()
  const normalizedOrderNumber = typeof orderNumber === 'string' ? orderNumber.trim().toUpperCase() : ''

  let resolvedOrderId: string | null = null
  let resolvedOrderNumber: string | null = null
  if (orderId || orderNumber) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ id: String(orderId) }] : []),
          ...(normalizedOrderNumber
            ? [
                { orderNumber: normalizedOrderNumber },
                ...(normalizedOrderNumber.length === 5
                  ? [
                      { orderNumber: { endsWith: normalizedOrderNumber } },
                      { id: { endsWith: normalizedOrderNumber.toLowerCase() } },
                    ]
                  : []),
              ]
            : []),
        ],
      },
      select: { id: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Referenced order not found.' }, { status: 404 })
    }
    resolvedOrderId = order.id
    resolvedOrderNumber = order.orderNumber ?? (await ensureOrderNumberForOrder(order.id))
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      type,
      subject,
      orderId: resolvedOrderId,
      orderNumber: resolvedOrderNumber,
      name,
      email,
      createdById,
      messages: {
        create: [{ authorId: createdById ?? undefined, authorRole: session?.user?.role ?? 'WEBSITE', body: message }],
      },
    },
    include: { messages: true },
  })

  return NextResponse.json({ ticketNumber: ticket.ticketNumber, ticketId: ticket.id, orderId: ticket.orderId, orderNumber: ticket.orderNumber })
}

export async function GET() {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } }, order: { select: { id: true, orderNumber: true, status: true } } },
  })
  return NextResponse.json(tickets)
}
