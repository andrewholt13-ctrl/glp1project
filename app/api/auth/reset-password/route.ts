export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit'
import { getRequestId, logApiEvent, redactEmail } from '@/lib/apiLogging'

function hashResetCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const ip = getClientIp(req)
  const limit = enforceRateLimit({
    key: `auth-reset:${ip}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  })
  if (!limit.allowed) {
    logApiEvent('warn', 'auth.reset.rate_limited', { requestId, ip })
    const retryAfter = Math.max(Math.ceil((limit.resetAt - Date.now()) / 1000), 1)
    return NextResponse.json(
      { error: 'Too many reset attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!email || !code || !newPassword) {
    logApiEvent('warn', 'auth.reset.invalid_request', { requestId, ip, email: redactEmail(email) })
    return NextResponse.json({ error: 'Email, code, and new password are required.' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    logApiEvent('warn', 'auth.reset.weak_password', { requestId, ip, email: redactEmail(email) })
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    logApiEvent('warn', 'auth.reset.invalid_code', { requestId, ip, email: redactEmail(email) })
    return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 })
  }

  if (user.passwordResetExpiresAt.getTime() < Date.now()) {
    logApiEvent('warn', 'auth.reset.expired_code', { requestId, ip, userId: user.id })
    return NextResponse.json({ error: 'Reset code has expired. Request a new one.' }, { status: 400 })
  }

  const tokenHash = hashResetCode(code)
  if (tokenHash !== user.passwordResetTokenHash) {
    logApiEvent('warn', 'auth.reset.invalid_code', { requestId, ip, userId: user.id })
    return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustResetPassword: false,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  })

  logApiEvent('info', 'auth.reset.completed', { requestId, ip, userId: user.id })

  return NextResponse.json({ ok: true })
}
