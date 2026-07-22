export const dynamic = 'force-dynamic'










import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['MASTER_ADMIN', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const med = await prisma.medication.update({ where: { id: params.id }, data: body })
  return NextResponse.json(med)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['MASTER_ADMIN', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.medication.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
