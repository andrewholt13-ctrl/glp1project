import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireApiRole } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['MASTER_ADMIN'])
  if (!auth.ok) return auth.error

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      providerProfile: true,
      influencerProfile: true,
      pharmacyProfile: true,
      patientProfile: true,
    },
  })

  if (!existing) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const body = await req.json()
  const role = typeof body.role === 'string' ? body.role : existing.role
  const profile = typeof body.profile === 'object' && body.profile ? body.profile : {}

  if (typeof body.email === 'string' && body.email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email: body.email } })
    if (taken) return NextResponse.json({ error: 'Email already exists.' }, { status: 409 })
  }

  const userData: Record<string, unknown> = {}
  if (typeof body.name === 'string') userData.name = body.name
  if (typeof body.email === 'string') userData.email = body.email
  if (typeof body.phone === 'string' || body.phone === null) userData.phone = body.phone
  if (typeof role === 'string') userData.role = role

  if (typeof body.password === 'string' && body.password.trim()) {
    userData.passwordHash = await bcrypt.hash(body.password.trim(), 10)
    userData.mustResetPassword = true
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: params.id }, data: userData })

    if (role === 'PROVIDER') {
      if (existing.providerProfile) {
        await tx.provider.update({
          where: { userId: params.id },
          data: {
            npiNumber: typeof profile.npiNumber === 'string' ? profile.npiNumber : existing.providerProfile.npiNumber,
            licenseNumber: typeof profile.licenseNumber === 'string' ? profile.licenseNumber : existing.providerProfile.licenseNumber,
            specialty: typeof profile.specialty === 'string' ? profile.specialty : existing.providerProfile.specialty,
            bio: typeof profile.bio === 'string' ? profile.bio : existing.providerProfile.bio,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : existing.providerProfile.isActive,
          },
        })
      } else {
        await tx.provider.create({
          data: {
            userId: params.id,
            npiNumber: typeof profile.npiNumber === 'string' ? profile.npiNumber : null,
            licenseNumber: typeof profile.licenseNumber === 'string' ? profile.licenseNumber : null,
            specialty: typeof profile.specialty === 'string' ? profile.specialty : null,
            bio: typeof profile.bio === 'string' ? profile.bio : null,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : true,
          },
        })
      }
    }

    if (role === 'PHARMACY') {
      if (existing.pharmacyProfile) {
        await tx.pharmacy.update({
          where: { userId: params.id },
          data: {
            address: typeof profile.address === 'string' ? profile.address : existing.pharmacyProfile.address,
            phone: typeof profile.phone === 'string' ? profile.phone : existing.pharmacyProfile.phone,
            licenseNum: typeof profile.licenseNum === 'string' ? profile.licenseNum : existing.pharmacyProfile.licenseNum,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : existing.pharmacyProfile.isActive,
          },
        })
      } else {
        await tx.pharmacy.create({
          data: {
            userId: params.id,
            address: typeof profile.address === 'string' ? profile.address : null,
            phone: typeof profile.phone === 'string' ? profile.phone : null,
            licenseNum: typeof profile.licenseNum === 'string' ? profile.licenseNum : null,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : true,
          },
        })
      }
    }

    if (role === 'INFLUENCER') {
      if (existing.influencerProfile) {
        await tx.influencer.update({
          where: { userId: params.id },
          data: {
            code: typeof profile.code === 'string' ? profile.code.toUpperCase() : existing.influencerProfile.code,
            commissionRate:
              typeof profile.commissionRate === 'number' && Number.isFinite(profile.commissionRate)
                ? profile.commissionRate
                : existing.influencerProfile.commissionRate,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : existing.influencerProfile.isActive,
          },
        })
      } else {
        await tx.influencer.create({
          data: {
            userId: params.id,
            code: typeof profile.code === 'string' ? profile.code.toUpperCase() : params.id.slice(0, 8).toUpperCase(),
            commissionRate:
              typeof profile.commissionRate === 'number' && Number.isFinite(profile.commissionRate)
                ? profile.commissionRate
                : 0,
            isActive: typeof profile.isActive === 'boolean' ? profile.isActive : true,
          },
        })
      }
    }

    if (role === 'PATIENT') {
      if (existing.patientProfile) {
        await tx.patient.update({
          where: { userId: params.id },
          data: {
            dateOfBirth: typeof profile.dateOfBirth === 'string' ? profile.dateOfBirth : existing.patientProfile.dateOfBirth,
            address: typeof profile.address === 'string' ? profile.address : existing.patientProfile.address,
            city: typeof profile.city === 'string' ? profile.city : existing.patientProfile.city,
            state: typeof profile.state === 'string' ? profile.state : existing.patientProfile.state,
            zip: typeof profile.zip === 'string' ? profile.zip : existing.patientProfile.zip,
          },
        })
      } else {
        await tx.patient.create({
          data: {
            userId: params.id,
            dateOfBirth: typeof profile.dateOfBirth === 'string' ? profile.dateOfBirth : null,
            address: typeof profile.address === 'string' ? profile.address : null,
            city: typeof profile.city === 'string' ? profile.city : null,
            state: typeof profile.state === 'string' ? profile.state : null,
            zip: typeof profile.zip === 'string' ? profile.zip : null,
          },
        })
      }
    }

    return user
  })

  const response = await prisma.user.findUnique({
    where: { id: updated.id },
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

  return NextResponse.json(response)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['MASTER_ADMIN'])
  if (!auth.ok) return auth.error
  const session = auth.session

  if (session.user.id === params.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  try {
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Could not delete user because related records exist. Update the account instead.' },
      { status: 400 }
    )
  }
}
