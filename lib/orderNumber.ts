import { prisma } from '@/lib/prisma'
import { toFiveCharCode } from '@/lib/orderRef'

declare global {
  // Persist capability detection across Next.js dev hot reloads.
  // eslint-disable-next-line no-var
  var __orderNumberSupported: boolean | null | undefined
}

function getOrderNumberSupported() {
  return globalThis.__orderNumberSupported ?? null
}

function setOrderNumberSupported(value: boolean) {
  globalThis.__orderNumberSupported = value
}

function buildCandidate() {
  const rand = Math.floor(Math.random() * Math.pow(36, 5))
  return rand.toString(36).toUpperCase().padStart(5, '0')
}

export async function generateOrderNumber(): Promise<string> {
  if (getOrderNumberSupported() === false) return buildCandidate()

  for (let i = 0; i < 20; i++) {
    const candidate = buildCandidate()
    let existing = null
    try {
      existing = await prisma.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } })
      setOrderNumberSupported(true)
    } catch {
      // Older Prisma clients/schemas may not have Order.orderNumber yet.
      setOrderNumberSupported(false)
      return candidate
    }
    if (!existing) return candidate
  }

  return buildCandidate()
}

export async function ensureOrderNumberForOrder(orderId: string): Promise<string> {
  if (getOrderNumberSupported() === false) return toFiveCharCode(orderId)

  let existing: { orderNumber: string | null } | null = null
  try {
    existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    })
    setOrderNumberSupported(true)
  } catch {
    // If runtime Prisma is behind schema, fallback to order id for communication.
    setOrderNumberSupported(false)
    return toFiveCharCode(orderId)
  }
  if (!existing) throw new Error('Order not found')
  if (existing.orderNumber) return existing.orderNumber

  for (let i = 0; i < 20; i++) {
    const candidate = await generateOrderNumber()
    const result = await prisma.order.updateMany({
      where: { id: orderId, orderNumber: null },
      data: { orderNumber: candidate },
    })
    if (result.count === 1) return candidate

    try {
      const nowAssigned = await prisma.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true },
      })
      setOrderNumberSupported(true)
      if (nowAssigned?.orderNumber) return nowAssigned.orderNumber
    } catch {
      setOrderNumberSupported(false)
      return toFiveCharCode(orderId)
    }
  }

  const fallback = buildCandidate()
  try {
    await prisma.order.updateMany({ where: { id: orderId, orderNumber: null }, data: { orderNumber: fallback } })
    setOrderNumberSupported(true)
    return fallback
  } catch {
    setOrderNumberSupported(false)
    return toFiveCharCode(orderId)
  }
}
