export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit'
import { getRequestId, logApiEvent, redactEmail } from '@/lib/apiLogging'
import { buildPasswordResetEmail, sendPasswordResetEmail } from '@/lib/email'
import { sendPasswordResetSms } from '@/lib/notifications'

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
  const deliveryMethod = typeof body?.deliveryMethod === 'string' ? body.deliveryMethod : 'email'

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
    const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/reset-password?email=${encodeURIComponent(user.email)}&token=${code}`
    let delivered = false
    let deliveryMessage = 'A reset link is ready. Use it to continue with password reset.'

    if (deliveryMethod === 'sms' && user.phone) {
      try {
        delivered = await sendPasswordResetSms({
          phone: user.phone,
          resetCode: code,
          appName,
          firstName: user.name?.split(' ')[0] ?? undefined,
        })
      } catch (error) {
        logApiEvent('warn', 'auth.forgot.sms_error', { requestId, userId: user.id, phone: user.phone, error: error instanceof Error ? error.message : String(error) })
      }

      if (delivered) {
        logApiEvent('info', 'auth.forgot.sms_sent', { requestId, userId: user.id, phone: user.phone })
        deliveryMessage = 'A reset code was sent to your phone number.'
      } else {
        logApiEvent('info', 'auth.forgot.generated_dev_code', { requestId, userId: user.id })
      }
    } else {
      const emailPayload = buildPasswordResetEmail({
        to: user.email,
        resetCode: code,
        appName,
        resetUrl,
      })

      try {
        delivered = await sendPasswordResetEmail(emailPayload)
      } catch (error) {
        logApiEvent('warn', 'auth.forgot.mail_error', { requestId, userId: user.id, email: redactEmail(user.email), error: error instanceof Error ? error.message : String(error) })
      }

      if (delivered) {
        logApiEvent('info', 'auth.forgot.email_sent', { requestId, userId: user.id, email: redactEmail(user.email) })
        deliveryMessage = 'A reset link was sent to your email address.'
      } else {
        logApiEvent('info', 'auth.forgot.generated_dev_code', { requestId, userId: user.id })
      }
    }

    return NextResponse.json({
      ok: true,
      resetCode: code,
      message: delivered ? deliveryMessage : 'A reset link is ready. Open it on the next screen to continue—no paid provider is required.',
    })
  }

  logApiEvent('info', 'auth.forgot.completed', { requestId, ip, email: redactEmail(email) })

  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a reset code has been generated.',
  })
}
