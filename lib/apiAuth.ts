import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

type Role = 'MASTER_ADMIN' | 'ADMIN' | 'PROVIDER' | 'PATIENT' | 'INFLUENCER' | 'PHARMACY'

export async function requireApiSession() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
    }
  }

  return {
    ok: true as const,
    session: session as Session,
  }
}

export async function requireApiRole(allowedRoles: Role[]) {
  const auth = await requireApiSession()
  if (!auth.ok) return auth

  if (!allowedRoles.includes(auth.session.user.role as Role)) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return auth
}
