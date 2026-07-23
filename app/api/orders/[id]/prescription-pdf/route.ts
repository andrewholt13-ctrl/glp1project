export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/apiAuth'
import { parsePrescriptionMeta } from '@/lib/prescriptionMeta'

function compact(value: string | null | undefined, fallback = 'Not provided') {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : fallback
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').toLowerCase()
}

function truncate(value: string, max = 300) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['MASTER_ADMIN', 'ADMIN', 'PROVIDER'])
  if (!auth.ok) return auth.error
  const session = auth.session

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      patient: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      provider: { include: { user: { select: { id: true, name: true, phone: true } } } },
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

  const selectedMeds = order.orderMedications.length > 0
    ? order.orderMedications.map((item) => item.medication)
    : (order.medication ? [order.medication] : [])
  const prescriptionMeta = parsePrescriptionMeta(order.notes)

  const qs = req.nextUrl.searchParams
  const providerAddress = truncate(compact(qs.get('providerAddress')))
  const providerPhone = truncate(compact(qs.get('providerPhone') ?? order.provider?.user?.phone))
  const providerNpi = truncate(compact(qs.get('providerNpi') ?? order.provider?.npiNumber))
  const medicationName = truncate(compact(qs.get('medicationName') ?? (selectedMeds.length > 0 ? selectedMeds.map((m) => m.name).join(', ') : null)))
  const directions = truncate(compact(qs.get('directions') ?? selectedMeds[0]?.directions))
  const quantity = truncate(compact(qs.get('quantity') ?? prescriptionMeta?.quantity ?? selectedMeds[0]?.quantity))
  const refills = truncate(compact(qs.get('refills'), String(prescriptionMeta?.refillsRemaining ?? 0)))
  const writtenDate = truncate(compact(qs.get('writtenDate'), prescriptionMeta?.writtenDate ?? new Date().toISOString().slice(0, 10)))

  const patientAddress = [order.patient.address, order.patient.city, order.patient.state, order.patient.zip]
    .filter(Boolean)
    .join(', ')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const drawLine = (text: string, y: number, size = 11, bold = false) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    })
  }

  let y = 740
  drawLine('Prescription Order', y, 22, true)
  y -= 28
  drawLine(`Written Date: ${writtenDate}`, y)
  y -= 22
  drawLine(`Order Number: ${order.orderNumber ?? order.id.slice(0, 8)}`, y)

  y -= 32
  drawLine('Provider Information', y, 14, true)
  y -= 20
  drawLine(`Name: ${compact(order.provider?.user?.name, 'Not assigned')}`, y)
  y -= 18
  drawLine(`Address: ${providerAddress}`, y)
  y -= 18
  drawLine(`Phone: ${providerPhone}`, y)
  y -= 18
  drawLine(`NPI: ${providerNpi}`, y)

  y -= 30
  drawLine('Patient Information', y, 14, true)
  y -= 20
  drawLine(`Name: ${compact(order.patient.user.name)}`, y)
  y -= 18
  drawLine(`DOB: ${compact(order.patient.dateOfBirth)}`, y)
  y -= 18
  drawLine(`Address: ${compact(patientAddress, 'Not provided')}`, y)

  y -= 30
  drawLine('Medication Details', y, 14, true)
  y -= 20
  drawLine(`Selected Drug: ${medicationName}`, y)
  y -= 18
  drawLine(`Directions: ${directions}`, y)
  y -= 18
  drawLine(`Quantity: ${quantity}`, y)
  y -= 18
  drawLine(`Refills: ${refills}`, y)

  y -= 40
  drawLine('Provider Signature: ________________________________', y)

  const pdfBytes = await pdf.save()
  const patientSlug = safeFilePart(order.patient.user.name || 'patient')
  const fileName = `prescription-${patientSlug}-${order.id.slice(0, 8)}.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
