import { randomUUID } from 'crypto'

export function getRequestId(req: Request) {
  return req.headers.get('x-request-id') || randomUUID()
}

export function redactEmail(email: string) {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at <= 1) return '***'
  return `${trimmed[0]}***${trimmed.slice(at)}`
}

export function logApiEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, unknown>
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  }

  if (level === 'error') {
    console.error(JSON.stringify(payload))
    return
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(payload))
    return
  }
  console.info(JSON.stringify(payload))
}
