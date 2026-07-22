export function toFiveCharCode(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!normalized) return '00000'
  if (normalized.length >= 5) return normalized.slice(-5)
  return normalized.padStart(5, '0')
}

export function getOrderRef(orderNumber: string | null | undefined, orderId: string | null | undefined): string {
  if (orderNumber && orderNumber.trim()) return toFiveCharCode(orderNumber)
  if (orderId && orderId.trim()) return toFiveCharCode(orderId)
  return '00000'
}