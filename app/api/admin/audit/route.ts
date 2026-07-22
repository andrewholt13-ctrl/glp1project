import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function toCsvField(value: unknown) {
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (session.user.role !== 'MASTER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const takeParam = Number(req.nextUrl.searchParams.get('take') ?? '200')
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 500) : 200
  const action = req.nextUrl.searchParams.get('action')
  const actorRole = req.nextUrl.searchParams.get('actorRole')
  const orderId = req.nextUrl.searchParams.get('orderId')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase()

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (actorRole) where.actorRole = actorRole
  if (orderId) where.orderId = orderId
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { name: true, email: true, role: true } },
      order: { select: { id: true, status: true, amountPaid: true, trackingNumber: true } },
    },
  })

  if (format === 'csv') {
    const headers = ['createdAt', 'action', 'entityType', 'entityId', 'orderId', 'actorRole', 'actorName', 'actorEmail', 'reason', 'beforeValue', 'afterValue']
    const lines = [headers.join(',')]
    for (const log of logs) {
      lines.push([
        toCsvField(log.createdAt.toISOString()),
        toCsvField(log.action),
        toCsvField(log.entityType),
        toCsvField(log.entityId),
        toCsvField(log.orderId ?? ''),
        toCsvField(log.actorRole),
        toCsvField(log.actor?.name ?? 'System'),
        toCsvField(log.actor?.email ?? ''),
        toCsvField(log.reason ?? ''),
        toCsvField(log.beforeValue ?? ''),
        toCsvField(log.afterValue ?? ''),
      ].join(','))
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json(logs)
}
