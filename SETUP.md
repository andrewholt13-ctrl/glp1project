# GLP-1 Wellness Platform — Setup Guide

## Prerequisites
- Node.js 18+
- A Stripe account (https://stripe.com)
- Git

---

## 1. Install Dependencies

```bash
cd glp1-platform
npm install
```

---

## 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Get your Stripe keys from: https://dashboard.stripe.com/apikeys

---

## 3. Set Up the Database

```bash
npm run db:push    # Creates the SQLite database
npm run db:seed    # Loads sample data (medications, users)
```

### Seed Accounts Created:
| Role | Email | Password |
|------|-------|----------|
| Master Admin | admin@glp1platform.com | Admin@123! |
| Provider | doctor@glp1platform.com | Doctor@123! |
| Pharmacy | pharmacy@glp1platform.com | Pharmacy@123! |
| Influencer | influencer@glp1platform.com | Influencer@123! |

Influencer referral code: **ALEXRIVERS**

---

## 4. Set Up Stripe Webhooks (for payment confirmation)

Install Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret it gives you into `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## 5. Run the App

```bash
npm run dev
```

Open http://localhost:3000

---

## User Flows

### Patient Flow
1. Visit `http://localhost:3000`
2. Select **Georgia** → fill out 3-step intake form
3. Choose medication → pay via Stripe
4. Log in at `/login` to track status at `/status`

### Influencer Link
Share: `http://localhost:3000/?ref=ALEXRIVERS`  
Patients who sign up via this link are auto-attributed to the influencer.

### QR Code
Generate a QR code for `http://yourdomain.com/?ref=YOURCODE` using any QR generator.

---

## Portal URLs
| Role | URL |
|------|-----|
| Patient Status | `/status` |
| Master Admin | `/admin` |
| Provider | `/provider` |
| Pharmacy | `/pharmacy` |
| Influencer | `/influencer` |

---

## Deployment (Vercel — Recommended)

1. Push to GitHub
2. Import repo in Vercel (https://vercel.com/new)
3. Add all env vars in Vercel project settings
4. Change `DATABASE_URL` to a Postgres connection string (e.g., Supabase, Neon, or Railway)
5. Update `prisma/schema.prisma` datasource from `sqlite` to `postgresql`
6. Deploy

For production Postgres, run: `npx prisma migrate deploy`

---

## Switching to PostgreSQL (Production)

In `prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then run: `npm run db:push` with your Postgres `DATABASE_URL`.

---

## Legal Reminder

Before launching, consult a healthcare attorney to confirm:
- Your influencer compensation structure complies with state anti-kickback laws
- Provider workflows meet Georgia telemedicine standards
- Platform consent forms, privacy policy, and BAA are in place
- HIPAA-compliant hosting is used in production (Vercel + encrypted Postgres qualifies)
