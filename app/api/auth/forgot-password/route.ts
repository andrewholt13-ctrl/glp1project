export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit'
import { getRequestId, logApiEvent, redactEmail } from '@/lib/apiLogging'
import { buildPasswordResetEmail, sendPasswordResetEmail } from '@/lib/email'

function hashResetCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

function generateResetCode() {
  // 6-digit numeric code for simple user entry
  return String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0')
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const ip = getClientIp(req)
  const limit = enforceRateLimit({
    key: `auth-forgot:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!limit.allowed) {
    logApiEvent('warn', 'auth.forgot.rate_limited', { requestId, ip })
    const retryAfter = Math.max(Math.ceil((limit.resetAt - Date.now()) / 1000), 1)
    return NextResponse.json(
      { error: 'Too many reset requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    logApiEvent('warn', 'auth.forgot.invalid_request', { requestId, ip })
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  logApiEvent('info', 'auth.forgot.requested', { requestId, ip, email: redactEmail(email) })

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const code = generateResetCode()
    const tokenHash = hashResetCode(code)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    })

    const appName = process.env.APP_NAME ?? 'Butter Health'
    const emailPayload = buildPasswordResetEmail({
      to: user.email,
      resetCode: code,
      appName,
    })

    const mailSent = await sendPasswordResetEmail(emailPayload)

    if (!mailSent) {
      if (process.env.NODE_ENV !== 'production') {
        logApiEvent('info', 'auth.forgot.generated_dev_code', { requestId, userId: user.id })
        return NextResponse.json({ ok: true, resetCode: code })
      }

      logApiEvent('warn', 'auth.forgot.mail_unavailable', { requestId, userId: user.id, email: redactEmail(user.email) })
      return NextResponse.json({ ok: true, message: 'Password reset requested. If email delivery is unavailable, contact support.' })
    }

    logApiEvent('info', 'auth.forgot.email_sent', { requestId, userId: user.id, email: redactEmail(user.email) })
  }

  logApiEvent('info', 'auth.forgot.completed', { requestId, ip, email: redactEmail(email) })

  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a reset code has been generated.',
  })
}
