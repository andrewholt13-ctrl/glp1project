export type PrescriptionMeta = {
  quantity: string
  refillsTotal: number
  refillsRemaining: number
  writtenDate: string
  prescribedAt: string
  expiresAt: string
  isDiscontinued: boolean
  discontinueReason: string | null
}

const TOKEN_KEY = 'RXMETA_JSON='
const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRY_DAYS = 360

function clampRefillCount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(99, Math.floor(parsed)))
}

function normalizeIsoDate(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback.toISOString().slice(0, 10)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number) {
  const parsed = new Date(isoDate)
  const next = new Date(parsed.getTime() + (days * DAY_MS))
  return next.toISOString().slice(0, 10)
}

function getTokenValue(notes: string | null | undefined) {
  if (!notes) return null
  const match = notes.match(/(?:^|;)RXMETA_JSON=([^;]+)/)
  return match?.[1] ?? null
}

function stripToken(notes: string | null | undefined) {
  if (!notes) return ''
  return notes
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(TOKEN_KEY))
    .join(';')
}

export function parsePrescriptionMeta(notes: string | null | undefined): PrescriptionMeta | null {
  const token = getTokenValue(notes)
  if (!token) return null

  try {
    const json = decodeURIComponent(token)
    const raw = JSON.parse(json) as Partial<PrescriptionMeta>
    if (!raw.prescribedAt) return null

    const prescribedAt = normalizeIsoDate(raw.prescribedAt, new Date())
    const writtenDate = normalizeIsoDate(raw.writtenDate ?? raw.prescribedAt, new Date(prescribedAt))
    const expiresAt = normalizeIsoDate(raw.expiresAt ?? addDays(prescribedAt, EXPIRY_DAYS), new Date(addDays(prescribedAt, EXPIRY_DAYS)))
    const refillsTotal = clampRefillCount(raw.refillsTotal)
    const refillsRemaining = Math.min(refillsTotal, clampRefillCount(raw.refillsRemaining))

    return {
      quantity: typeof raw.quantity === 'string' ? raw.quantity : '',
      refillsTotal,
      refillsRemaining,
      writtenDate,
      prescribedAt,
      expiresAt,
      isDiscontinued: Boolean(raw.isDiscontinued),
      discontinueReason: typeof raw.discontinueReason === 'string' ? raw.discontinueReason : null,
    }
  } catch {
    return null
  }
}

export function upsertPrescriptionMeta(notes: string | null | undefined, meta: PrescriptionMeta) {
  const base = stripToken(notes)
  const payload = encodeURIComponent(JSON.stringify(meta))
  return base ? `${base};${TOKEN_KEY}${payload}` : `${TOKEN_KEY}${payload}`
}

export function createPrescriptionMeta(input: {
  quantity: string
  refillCount: number
  prescribedAt?: string | null
  writtenDate?: string | null
}) {
  const now = new Date()
  const prescribedAt = normalizeIsoDate(input.prescribedAt ?? null, now)
  const writtenDate = normalizeIsoDate(input.writtenDate ?? prescribedAt, new Date(prescribedAt))
  const refillsTotal = clampRefillCount(input.refillCount)
  return {
    quantity: input.quantity?.trim() || '',
    refillsTotal,
    refillsRemaining: refillsTotal,
    writtenDate,
    prescribedAt,
    expiresAt: addDays(prescribedAt, EXPIRY_DAYS),
    isDiscontinued: false,
    discontinueReason: null,
  } as PrescriptionMeta
}

export function isPrescriptionExpired(meta: PrescriptionMeta, now: Date = new Date()) {
  const expiry = new Date(meta.expiresAt)
  if (Number.isNaN(expiry.getTime())) return false
  return now.getTime() > expiry.getTime()
}

export function discontinueExpiredPrescription(meta: PrescriptionMeta) {
  return {
    ...meta,
    refillsRemaining: 0,
    isDiscontinued: true,
    discontinueReason: 'Refills are expired',
  } satisfies PrescriptionMeta
}

export function decrementRefill(meta: PrescriptionMeta) {
  return {
    ...meta,
    refillsRemaining: Math.max(0, meta.refillsRemaining - 1),
  } satisfies PrescriptionMeta
}

export function getRefillSourceOrderId(notes: string | null | undefined) {
  if (!notes) return null
  const match = notes.match(/(?:^|;)REFILL_OF:([^;]+)/)
  return match?.[1] ?? null
}
