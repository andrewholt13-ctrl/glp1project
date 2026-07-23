export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib'
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

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * (size + 3),
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })
  })

  return lines.length
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

  const width = 612
  const height = 792
  const margin = 42
  const contentWidth = width - margin * 2

  page.drawRectangle({
    x: margin - 8,
    y: margin - 8,
    width: contentWidth + 16,
    height: height - margin * 2 + 16,
    borderColor: rgb(0.86, 0.86, 0.86),
    borderWidth: 1,
  })

  page.drawText('PRESCRIPTION', {
    x: margin,
    y: height - 70,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.08),
  })

  page.drawText('Rx', {
    x: margin,
    y: height - 120,
    size: 30,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.08),
  })

  const providerName = compact(order.provider?.user?.name, 'Not assigned')
  const orderRef = order.orderNumber ?? order.id.slice(0, 8)

  page.drawText(providerName, {
    x: margin,
    y: height - 92,
    size: 13,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.08),
  })
  page.drawText(providerAddress, {
    x: margin,
    y: height - 108,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText(`Phone: ${providerPhone}   NPI: ${providerNpi}`, {
    x: margin,
    y: height - 122,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Date Written: ${writtenDate}`, {
    x: width - margin - 180,
    y: height - 92,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
  page.drawText(`Order #: ${orderRef}`, {
    x: width - margin - 180,
    y: height - 108,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })

  let y = height - 160
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  })

  y -= 22
  page.drawText(`Patient: ${compact(order.patient.user.name)}`, {
    x: margin,
    y,
    size: 12,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
  page.drawText(`DOB: ${compact(order.patient.dateOfBirth)}`, {
    x: width - margin - 180,
    y,
    size: 12,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })

  y -= 18
  page.drawText(`Address: ${compact(patientAddress, 'Not provided')}`, {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 22
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })

  y -= 26
  page.drawText('Medication:', {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  const medLines = drawWrappedText(page, medicationName, margin + 85, y, contentWidth - 90, font, 12)

  y -= Math.max(20, medLines * 15)
  page.drawText('Directions:', {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  const dirLines = drawWrappedText(page, directions, margin + 85, y, contentWidth - 90, font, 11)

  y -= Math.max(24, dirLines * 14 + 8)
  page.drawText(`Quantity: ${quantity}`, {
    x: margin,
    y,
    size: 12,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
  page.drawText(`Refills: ${refills}`, {
    x: margin + 250,
    y,
    size: 12,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })

  y -= 42
  const signatureX = width - margin - 240
  page.drawLine({
    start: { x: signatureX, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText('Provider Signature', {
    x: signatureX,
    y: y - 12,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(providerName, {
    x: signatureX,
    y: y - 28,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.08),
  })

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
