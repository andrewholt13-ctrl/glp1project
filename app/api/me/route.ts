import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  return NextResponse.json({
    role: session.user.role,
    id: session.user.id,
    name: session.user.name,
    mustResetPassword: Boolean(session.user.mustResetPassword),
  })
}
