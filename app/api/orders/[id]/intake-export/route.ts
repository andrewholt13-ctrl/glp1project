export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/apiAuth'

function normalizeList(value: string | null) {
  if (!value) return 'None reported'
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.length ? parsed.join(', ') : 'None reported'
    return String(parsed)
  } catch {
    return value
  }
}

function yesNo(value: boolean | null) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not answered'
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').toLowerCase()
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['MASTER_ADMIN', 'ADMIN', 'PROVIDER'])
  if (!auth.ok) return auth.error
  const session = auth.session

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      patient: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      provider: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      medication: { select: { name: true, directions: true, quantity: true } },
      orderMedications: { include: { medication: { select: { name: true, directions: true, quantity: true } } } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (session.user.role === 'PROVIDER' && order.provider?.user?.id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = order.patient
  const selectedMeds = order.orderMedications.length > 0
    ? order.orderMedications.map((item) => item.medication)
    : (order.medication ? [order.medication] : [])

  const intakeReport = [
    'BUTTER HEALTH - INTAKE EXPORT',
    `Generated: ${new Date().toISOString()}`,
    `Order ID: ${order.id}`,
    `Order Number: ${order.orderNumber ?? 'Not assigned'}`,
    '',
    'PATIENT INFORMATION',
    `Name: ${patient.user.name}`,
    `Email: ${patient.user.email}`,
    `Phone: ${patient.user.phone ?? 'Not provided'}`,
    `Date of Birth: ${patient.dateOfBirth ?? 'Not provided'}`,
    `Address: ${patient.address ?? 'Not provided'}`,
    `City: ${patient.city ?? 'Not provided'}`,
    `State: ${patient.state ?? 'Not provided'}`,
    `ZIP: ${patient.zip ?? 'Not provided'}`,
    '',
    'INTAKE RESPONSES',
    `Weight: ${patient.weight ?? 'Not provided'}`,
    `Height: ${patient.height ?? 'Not provided'}`,
    `Allergies: ${patient.allergies ?? 'None reported'}`,
    `Current Medications: ${patient.currentMeds ?? 'None reported'}`,
    `Medical History: ${patient.medicalHistory ?? 'None reported'}`,
    `PCP Seen in Past Year: ${yesNo(patient.pcpSeen)}`,
    `Heart/Cardiac Conditions: ${normalizeList(patient.heartConditions)}`,
    `Endocrine/Kidney/Liver Conditions: ${normalizeList(patient.endocrineConditions)}`,
    `Cancer History: ${patient.cancerHistory ?? 'None reported'}`,
    `Diabetes Status: ${patient.diabetesStatus ?? 'None reported'}`,
    `GI/Digestive Conditions: ${normalizeList(patient.giConditions)}`,
    `Referral Code: ${patient.referredBy ?? 'None provided'}`,
    '',
    'ORDER MEDICATIONS',
    ...(selectedMeds.length > 0
      ? selectedMeds.map((medication, index) => (
          `${index + 1}. ${medication.name} | Directions: ${medication.directions ?? 'Not provided'} | Quantity: ${medication.quantity ?? 'Not provided'}`
        ))
      : ['No medication selected']),
    '',
    'PROVIDER',
    `Name: ${order.provider?.user?.name ?? 'Not assigned'}`,
    `Email: ${order.provider?.user?.email ?? 'Not provided'}`,
    `Phone: ${order.provider?.user?.phone ?? 'Not provided'}`,
    `NPI: ${order.provider?.npiNumber ?? 'Not provided'}`,
  ].join('\n')

  const patientSlug = safeFilePart(patient.user.name || 'patient')
  const dispositionName = `intake-${patientSlug}-${order.id.slice(0, 8)}.txt`

  return new NextResponse(intakeReport, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dispositionName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
