export const dynamic = 'force-dynamic'










import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const influencer = await prisma.influencer.findUnique({
    where: { userId: session.user.id },
  })
  return NextResponse.json(influencer ?? {})
}
