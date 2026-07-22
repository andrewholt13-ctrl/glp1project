export const dynamic = 'force-dynamic'






import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'

  const meds = await prisma.medication.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { price: 'asc' },
  })
  return NextResponse.json(meds)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['MASTER_ADMIN', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const med = await prisma.medication.create({ data: body })
  return NextResponse.json(med, { status: 201 })
}
