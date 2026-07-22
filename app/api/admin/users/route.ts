import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireApiRole } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

function isLegacyUserSchemaError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('mustResetPassword') || message.includes('Unknown argument') || message.includes('no such column')
}

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(['MASTER_ADMIN'])
  if (!auth.ok) return auth.error

  try {
    const searchParams = req.nextUrl.searchParams
    const role = searchParams.get('role')

    try {
      const users = await prisma.user.findMany({
        where: role ? { role: role as any } : {},
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          mustResetPassword: true,
          createdAt: true,
          updatedAt: true,
          providerProfile: true,
          influencerProfile: true,
          pharmacyProfile: true,
          patientProfile: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(users)
    } catch (err) {
      if (!isLegacyUserSchemaError(err)) throw err

      const users = await prisma.user.findMany({
        where: role ? { role: role as any } : {},
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          providerProfile: true,
          influencerProfile: true,
          pharmacyProfile: true,
          patientProfile: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(users.map((u) => ({ ...u, mustResetPassword: false })))
    }
  } catch (err) {
    console.error('Failed to load admin users', err)
    return NextResponse.json({ error: 'Could not load users.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(['MASTER_ADMIN'])
  if (!auth.ok) return auth.error

  try {
    const body = await req.json()
    const { email, password, name, phone, role, profile } = body

    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email already exists.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password ?? 'TempPass123!', 10)

    const createData: any = {
      email, passwordHash, name, phone, role,
      mustResetPassword: true,
    }

    if (role === 'PROVIDER' && profile) {
      createData.providerProfile = {
        create: {
          npiNumber: profile.npiNumber ?? null,
          licenseNumber: profile.licenseNumber ?? null,
          specialty: profile.specialty ?? null,
          bio: profile.bio ?? null,
        },
      }
    } else if (role === 'INFLUENCER' && profile) {
      createData.influencerProfile = {
        create: {
          code: (profile.code ?? name.replace(/\s+/g, '').toUpperCase()),
          commissionRate: profile.commissionRate ?? 0,
        },
      }
    } else if (role === 'PHARMACY' && profile) {
      createData.pharmacyProfile = {
        create: {
          address: profile.address ?? null,
          phone: profile.phone ?? null,
          licenseNum: profile.licenseNum ?? null,
        },
      }
    } else if (role === 'PATIENT') {
      createData.patientProfile = {
        create: {
          dateOfBirth: profile?.dateOfBirth ?? null,
          address: profile?.address ?? null,
          city: profile?.city ?? null,
          state: profile?.state ?? null,
          zip: profile?.zip ?? null,
        },
      }
    }

    try {
      const user = await prisma.user.create({
        data: createData,
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          mustResetPassword: true,
          createdAt: true,
          updatedAt: true,
          providerProfile: true,
          influencerProfile: true,
          pharmacyProfile: true,
          patientProfile: true,
        },
      })
      return NextResponse.json(user, { status: 201 })
    } catch (err) {
      if (!isLegacyUserSchemaError(err)) throw err

      const legacyCreateData = { ...createData }
      delete legacyCreateData.mustResetPassword

      const user = await prisma.user.create({
        data: legacyCreateData,
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          providerProfile: true,
          influencerProfile: true,
          pharmacyProfile: true,
          patientProfile: true,
        },
      })
      return NextResponse.json({ ...user, mustResetPassword: false }, { status: 201 })
    }
  } catch (err) {
    console.error('Failed to create admin user', err)
    return NextResponse.json({ error: 'Could not create user.' }, { status: 500 })
  }
}
