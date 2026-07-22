function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return ''
}

export async function sendPaymentRequiredSms({
  phone,
  firstName,
  orderId,
}: {
  phone: string
  firstName: string
  orderId: string
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) return

  const to = normalizePhone(phone)
  if (!to) return

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const portalLink = `${baseUrl}/status`
  const safeName = firstName?.trim() || 'there'
  const body = `Hi ${safeName}, your provider has completed review and payment is now required before shipping can begin. Please sign in to continue: ${portalLink} (Order: ${orderId.slice(0, 8)})`

  const payload = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body,
  })

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })
}