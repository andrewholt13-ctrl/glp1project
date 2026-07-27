import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const envPath = path.resolve(process.cwd(), '.env')
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  const match = env.match(/^DATABASE_URL\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\n]+))/m)
  if (match) {
    process.env.DATABASE_URL = match[1] || match[2] || match[3]
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`
}

if (process.env.DATABASE_URL.startsWith('file:./') || process.env.DATABASE_URL.startsWith('file:../')) {
  const relativePath = process.env.DATABASE_URL.slice(5)
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), relativePath)}`
}

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10)

  // Master Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@butterhealth.com' },
    update: {},
    create: {
      email: 'admin@butterhealth.com',
      passwordHash: hash('Admin@123!'),
      role: 'MASTER_ADMIN',
      name: 'Master Admin',
    },
  })

  // Daily Admin
  await prisma.user.upsert({
    where: { email: 'ops@butterhealth.com' },
    update: {},
    create: {
      email: 'ops@butterhealth.com',
      passwordHash: hash('OpsAdmin@123!'),
      role: 'ADMIN',
      name: 'Operations Admin',
    },
  })

  // Sample Provider
  const providerUser = await prisma.user.upsert({
    where: { email: 'doctor@butterhealth.com' },
    update: {},
    create: {
      email: 'doctor@butterhealth.com',
      passwordHash: hash('Doctor@123!'),
      role: 'PROVIDER',
      name: 'Dr. Sarah Johnson',
      phone: '(404) 555-0100',
      providerProfile: {
        create: {
          npiNumber: '1234567890',
          licenseNumber: 'GA-MD-12345',
          specialty: 'Internal Medicine / Obesity Medicine',
          bio: 'Board-certified internist specializing in weight management and metabolic health.',
          isActive: true,
        },
      },
    },
  })

  // Sample Pharmacy
  const pharmacyUser = await prisma.user.upsert({
    where: { email: 'pharmacy@butterhealth.com' },
    update: {},
    create: {
      email: 'pharmacy@butterhealth.com',
      passwordHash: hash('Pharmacy@123!'),
      role: 'PHARMACY',
      name: 'Peach State Compounding',
      phone: '(404) 555-0200',
      pharmacyProfile: {
        create: {
          address: '123 Peachtree St, Atlanta, GA 30301',
          phone: '(404) 555-0200',
          licenseNum: 'GA-PH-99001',
          isActive: true,
        },
      },
    },
  })

  // Sample Influencer
  const influencerUser = await prisma.user.upsert({
    where: { email: 'influencer@butterhealth.com' },
    update: {},
    create: {
      email: 'influencer@butterhealth.com',
      passwordHash: hash('Influencer@123!'),
      role: 'INFLUENCER',
      name: 'Alex Rivers',
      influencerProfile: {
        create: {
          code: 'ALEXRIVERS',
          commissionRate: 50,
          isActive: true,
        },
      },
    },
  })

  // Medications
  await prisma.medication.createMany({
    data: [
      {
        name: 'Semaglutide 0.25mg/week',
        description: 'Compounded semaglutide injection — starter dose for weeks 1–4',
        directions: 'Inject 0.25mg subcutaneously once weekly. Rotate injection sites (abdomen, thigh, or upper arm).',
        quantity: '4 week supply (4 doses)',
        price: 299,
        isActive: true,
      },
      {
        name: 'Semaglutide 0.5mg/week',
        description: 'Compounded semaglutide injection — maintenance dose months 2–3',
        directions: 'Inject 0.5mg subcutaneously once weekly.',
        quantity: '4 week supply (4 doses)',
        price: 349,
        isActive: true,
      },
      {
        name: 'Semaglutide 1mg/week',
        description: 'Compounded semaglutide injection — therapeutic dose',
        directions: 'Inject 1mg subcutaneously once weekly.',
        quantity: '4 week supply (4 doses)',
        price: 399,
        isActive: true,
      },
      {
        name: 'Tirzepatide 2.5mg/week',
        description: 'Compounded tirzepatide injection — starter dose',
        directions: 'Inject 2.5mg subcutaneously once weekly for weeks 1–4.',
        quantity: '4 week supply (4 doses)',
        price: 399,
        isActive: true,
      },
      {
        name: 'Tirzepatide 5mg/week',
        description: 'Compounded tirzepatide injection — maintenance dose',
        directions: 'Inject 5mg subcutaneously once weekly.',
        quantity: '4 week supply (4 doses)',
        price: 449,
        isActive: true,
      },
    ],
  })

  // App settings
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      outOfStateUrl: 'https://example.com/national-program',
      platformName: 'Butter Health',
      supportEmail: 'support@butterhealth.com',
    },
  })

  console.log('✅ Seed complete')
  console.log('Admin: admin@butterhealth.com / Admin@123!')
  console.log('Ops Admin: ops@butterhealth.com / OpsAdmin@123!')
  console.log('Provider: doctor@butterhealth.com / Doctor@123!')
  console.log('Pharmacy: pharmacy@butterhealth.com / Pharmacy@123!')
  console.log('Influencer: influencer@butterhealth.com / Influencer@123!')
  console.log('Influencer code: ALEXRIVERS')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
