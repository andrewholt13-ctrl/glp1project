import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/orderNumber'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      firstName, lastName, email, phone, password,
      dateOfBirth, address, city, state, zip,
      weight, height, allergies, currentMeds, medicalHistory,
      medicationIds, referralCode, pcpSeen, heartConditions, endocrineConditions,
      cancerHistory, diabetesStatus, giConditions, providerId, pharmacyId,
    } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // Resolve influencer from referral code
    let influencerId: string | null = null
    if (referralCode) {
      const inf = await prisma.influencer.findUnique({ where: { code: referralCode.toUpperCase() } })
      if (inf) influencerId = inf.id
    }

    const requestedProviderId = typeof providerId === 'string' ? providerId : null
    const requestedPharmacyId = typeof pharmacyId === 'string' ? pharmacyId : null

    const [settings, selectedProvider, selectedPharmacy] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      requestedProviderId
        ? prisma.provider.findFirst({ where: { id: requestedProviderId, isActive: true } })
        : Promise.resolve(null),
      requestedPharmacyId
        ? prisma.pharmacy.findFirst({ where: { id: requestedPharmacyId, isActive: true } })
        : Promise.resolve(null),
    ])

    // Find default/first active pharmacy
    const pharmacy = selectedPharmacy
      ?? (settings?.defaultPharmacyId
        ? await prisma.pharmacy.findFirst({ where: { id: settings.defaultPharmacyId, isActive: true } })
        : null)
      ?? (await prisma.pharmacy.findFirst({ where: { isActive: true } }))

    // Find selected or first active provider
    const provider = selectedProvider ?? (await prisma.provider.findFirst({ where: { isActive: true } }))

    const normalizedMedicationIds = Array.isArray(medicationIds)
      ? [...new Set(medicationIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim()))].slice(0, 2)
      : []

    const validMedications = normalizedMedicationIds.length
      ? await prisma.medication.findMany({
          where: { id: { in: normalizedMedicationIds }, isActive: true },
          select: { id: true },
        })
      : []

    const orderMedicationConnect = validMedications.map((med) => ({
      medication: { connect: { id: med.id } },
    }))

    const createUserWithOrder = async (includeOrderNumber: boolean) => {
      const orderCreateData: Record<string, unknown> = {
        status: 'INTAKE_PENDING',
        // Patient medication picks are recommendations; provider sets final prescription later.
        medicationId: null,
        influencerId,
        providerId: provider?.id ?? null,
        pharmacyId: pharmacy?.id ?? null,
        orderMedications: orderMedicationConnect.length > 0 ? { create: orderMedicationConnect } : undefined,
      }

      if (includeOrderNumber) {
        orderCreateData.orderNumber = await generateOrderNumber()
      }

      return prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'PATIENT',
          name: `${firstName} ${lastName}`,
          phone,
          patientProfile: {
            create: {
              dateOfBirth,
              address,
              city,
              state,
              zip,
              weight,
              height,
              allergies,
              pcpSeen: typeof pcpSeen === 'boolean' ? pcpSeen : null,
              heartConditions: Array.isArray(heartConditions) ? JSON.stringify(heartConditions) : null,
              endocrineConditions: Array.isArray(endocrineConditions) ? JSON.stringify(endocrineConditions) : null,
              cancerHistory: typeof cancerHistory === 'string' ? cancerHistory : null,
              diabetesStatus: typeof diabetesStatus === 'string' ? diabetesStatus : null,
              giConditions: Array.isArray(giConditions) ? JSON.stringify(giConditions) : null,
              currentMeds,
              medicalHistory,
              referredBy: referralCode ?? null,
              orders: {
                create: orderCreateData,
              },
            },
          },
        },
        include: {
          patientProfile: {
            include: { orders: true },
          },
        },
      })
    }

    let user
    try {
      user = await createUserWithOrder(true)
    } catch (primaryErr) {
      console.error('Registration primary create failed; retrying without orderNumber', primaryErr)
      user = await createUserWithOrder(false)
    }

    const orderId = user.patientProfile?.orders[0]?.id ?? null
    return NextResponse.json({ userId: user.id, orderId })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}
