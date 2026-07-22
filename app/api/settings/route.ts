import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json(settings ?? {})
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'MASTER_ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: body,
    create: { id: 'singleton', ...body },
  })
  return NextResponse.json(settings)
}
