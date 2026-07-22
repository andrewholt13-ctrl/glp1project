import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Not supported' }, { status: 405 })
}
