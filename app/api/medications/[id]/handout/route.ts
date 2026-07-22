export const dynamic = 'force-dynamic'















import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['MASTER_ADMIN', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get('handout') as any

    if (!file || typeof file.type !== 'string' || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a PDF file' }, { status: 400 })
    }

    const fs = await import('fs')
    const path = await import('path')
    const uploadDir = path.join(process.cwd(), 'public', 'handouts')
    await fs.promises.mkdir(uploadDir, { recursive: true })

    const safeName = `${params.id}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    const filePath = path.join(uploadDir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.promises.writeFile(filePath, buffer)

    const handoutUrl = `/handouts/${safeName}`
    const med = await prisma.medication.update({ where: { id: params.id }, data: { handoutUrl } })
    return NextResponse.json({ handoutUrl, medication: med })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Handout upload failed:', message)
    return NextResponse.json({ error: message || 'Handout upload failed. Please try again.' }, { status: 500 })
  }
}
