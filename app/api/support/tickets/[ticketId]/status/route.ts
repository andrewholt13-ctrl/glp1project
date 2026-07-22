export const dynamic = 'force-dynamic'





















import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VALID_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'OPEN', 'RESOLVED'] as const

function normalizeStatus(value: string) {
  if (value === 'OPEN') return 'ACTIVE'
  if (value === 'RESOLVED') return 'COMPLETED'
  return value
}

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const requested = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
  if (!VALID_STATUSES.includes(requested as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.ticketId } })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const updated = await prisma.supportTicket.update({
    where: { id: params.ticketId },
    data: { status: normalizeStatus(requested), updatedAt: new Date() },
  })

  return NextResponse.json(updated)
}
