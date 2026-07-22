export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function isAuthorizedForDetailedHealth(req: NextRequest) {
  const token = process.env.HEALTHCHECK_TOKEN
  if (!token) return false

  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${token}`
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const detailed = isAuthorizedForDetailedHealth(req)

  let dbOk = false
  let dbLatencyMs: number | null = null

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - dbStart
    dbOk = true
  } catch {
    dbOk = false
  }

  const durationMs = Date.now() - startedAt
  const status = dbOk ? 'ok' : 'degraded'

  const response = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'up' : 'down',
    },
    latencyMs: {
      total: durationMs,
      database: dbLatencyMs,
    },
  }

  if (!detailed) {
    return NextResponse.json(
      {
        status: response.status,
        timestamp: response.timestamp,
        checks: response.checks,
      },
      { status: dbOk ? 200 : 503 },
    )
  }

  return NextResponse.json(response, { status: dbOk ? 200 : 503 })
}
