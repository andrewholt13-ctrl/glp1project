export const dynamic = 'force-dynamic'





















import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { message, body: messageBody, authorRole } = body
  const text = messageBody ?? message
  if (!text) return NextResponse.json({ error: 'Missing message body' }, { status: 400 })

  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.ticketId } })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const msg = await prisma.supportMessage.create({
    data: {
      ticketId: params.ticketId,
      authorId: session.user.id,
      authorRole: authorRole ?? session.user.role,
      body: text,
    },
  })

  await prisma.supportTicket.update({ where: { id: params.ticketId }, data: { updatedAt: new Date() } })

  return NextResponse.json(msg)
}
