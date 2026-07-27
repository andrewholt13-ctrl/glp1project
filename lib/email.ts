import { createTransport } from 'nodemailer'

export type PasswordResetEmail = {
  to: string
  subject: string
  text: string
  html: string
}

export function buildPasswordResetEmail({
  to,
  resetCode,
  appName,
}: {
  to: string
  resetCode: string
  appName: string
}): PasswordResetEmail {
  const subject = `${appName} password reset code`
  const text = `Hello,\n\nWe received a request to reset your password for ${appName}.\n\nYour reset code is: ${resetCode}\n\nEnter this code on the password reset page to continue. If you did not request this, you can ignore this email.`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 8px;">${appName}</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for ${appName}.</p>
      <p>Your reset code is:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em; margin: 12px 0;">${resetCode}</p>
      <p>Enter this code on the password reset page to continue. If you did not request this, you can ignore this email.</p>
    </div>
  `

  return { to, subject, text, html }
}

export async function sendPasswordResetEmail(email: PasswordResetEmail): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpSecure = process.env.SMTP_SECURE === 'true'
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'no-reply@butterhealth.com'

  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'onboarding@resend.dev'

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: fromAddress,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    return true
  }

  if (resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    })

    if (!response.ok) {
      throw new Error(`Resend email failed: ${response.status}`)
    }

    return true
  }

  return false
}
