import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['PROVIDER', 'PHARMACY', 'ADMIN', 'MASTER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const query = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '25')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 25

  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { user: { name: { contains: query } } },
            { user: { email: { contains: query } } },
            { user: { phone: { contains: query } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  return NextResponse.json(
    patients.map((patient) => ({
      id: patient.id,
      userId: patient.userId,
      name: patient.user.name,
      email: patient.user.email,
      phone: patient.user.phone,
    }))
  )
}
