export const dynamic = 'force-dynamic'






import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    select: {
      id: true,
      isActive: true,
      specialty: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(providers)
}
