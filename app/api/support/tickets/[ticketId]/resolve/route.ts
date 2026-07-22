export const dynamic = 'force-dynamic'





















import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.ticketId } })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const updated = await prisma.supportTicket.update({
    where: { id: params.ticketId },
    data: { status: 'COMPLETED' },
  })

  return NextResponse.json(updated)
}
