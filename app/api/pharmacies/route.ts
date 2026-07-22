import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [settings, pharmacies] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null),
    prisma.pharmacy.findMany({
      where: { isActive: true },
      select: {
        id: true,
        isActive: true,
        address: true,
        phone: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const defaultPharmacyId = settings?.defaultPharmacyId ?? null
  return NextResponse.json(
    pharmacies.map((pharmacy) => ({
      ...pharmacy,
      isDefault: defaultPharmacyId === pharmacy.id,
    }))
  )
}
