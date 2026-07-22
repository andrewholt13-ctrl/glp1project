# Phase 1 HIPAA Security Audit and Readiness Plan

Scope: Baseline assessment and implementation checklist before major backend/infrastructure changes.

Note: This is a technical readiness plan, not legal advice. HIPAA compliance requires legal, policy, and vendor controls in addition to code.

## Current Baseline (Observed)

### Authentication and sessions
- Credentials auth with hashed passwords (bcrypt) is implemented.
- Must-reset-password flow is implemented and enforced at login.
- JWT session strategy is used.
- File references:
  - [lib/auth.ts](lib/auth.ts)

### Access control
- Many API routes enforce role checks and ownership checks.
- Role checks are present in key order and admin endpoints.
- File references:
  - [app/api/orders/[id]/route.ts](app/api/orders/%5Bid%5D/route.ts)
  - [app/api/admin/users/route.ts](app/api/admin/users/route.ts)
  - [app/api/admin/users/[id]/route.ts](app/api/admin/users/%5Bid%5D/route.ts)

### Audit logging
- Audit log model exists and key order/payment transitions are logged.
- Admin audit viewer and CSV export exist.
- File references:
  - [prisma/schema.prisma](prisma/schema.prisma)
  - [app/api/admin/audit/route.ts](app/api/admin/audit/route.ts)
  - [app/admin/audit/page.tsx](app/admin/audit/page.tsx)
  - [app/api/orders/[id]/route.ts](app/api/orders/%5Bid%5D/route.ts)
  - [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)

### Payments
- Stripe Checkout and webhook processing are implemented.
- Multi-order payment support is implemented.
- File references:
  - [app/api/stripe/checkout/route.ts](app/api/stripe/checkout/route.ts)
  - [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)
  - [lib/stripe.ts](lib/stripe.ts)

### Data model and PHI footprint
- PHI and sensitive data fields are stored in user, patient, order, and support tables.
- Database is currently configured for SQLite by default.
- File references:
  - [prisma/schema.prisma](prisma/schema.prisma)
  - [SETUP.md](SETUP.md)
  - [.env.example](.env.example)

## Gaps to Close for HIPAA Readiness (Priority)

### Critical
1. Production database architecture not locked.
- Current default is SQLite; production should use managed Postgres with private networking and encrypted backups.

2. No formal encryption-at-application-field strategy for highly sensitive PHI.
- Managed encryption at rest is necessary but may be insufficient alone for risk posture.

3. Secrets and key-management policy is not documented.
- Need environment separation, rotation schedule, and vault-backed secrets process.

4. Security headers and transport hardening are minimal.
- Next config currently has no explicit security headers.

### High
1. Centralized authorization guard pattern is inconsistent.
- Many routes are secure, but enforcement is route-by-route and should be standardized.

2. Audit-log coverage is partial.
- Core order/payment events are logged, but not all PHI read/write events are guaranteed to be logged.

3. No explicit retention and deletion policy implemented.
- Need technical controls and schedule for data retention and archival.

4. No formal incident response and breach workflow in-repo.
- Need runbook and owner assignments.

### Medium
1. No explicit automated compliance checks in CI.
- Add dependency scanning, linting for unsafe patterns, and basic SAST.

2. Session hardening checklist is not documented.
- Cookie flags, token lifetimes, and re-auth requirements should be codified.

## Phase 1 Action Checklist (No Major Backend Rewrite)

### A. Governance and vendor controls
- [ ] Create vendor inventory: hosting, database, auth, email, SMS, payment, analytics, logging.
- [ ] Confirm Business Associate Agreement status for all vendors handling PHI.
- [ ] Document data flow map: intake -> provider -> pharmacy -> payment -> support.
- [ ] Assign security owner and incident owner.

### B. Environment and secrets hygiene
- [ ] Define env tiers: local, staging, production.
- [ ] Move production secrets to managed secret store.
- [ ] Create secret rotation policy (quarterly minimum for critical keys).
- [ ] Remove any real credentials from local docs/screenshots.

### C. Infrastructure baseline
- [ ] Decide production managed Postgres vendor.
- [ ] Enforce private DB access and IP restrictions.
- [ ] Enable encrypted backups and test restore process.
- [ ] Enforce TLS end-to-end.

### D. App security baseline
- [ ] Add secure HTTP headers (CSP baseline, HSTS, X-Content-Type-Options, Referrer-Policy).
- [ ] Add request rate limiting on auth, password reset, and support endpoints.
- [ ] Add brute-force protections for login and reset flows.
- [ ] Standardize role/ownership guard helpers for API routes.

### E. Audit and monitoring
- [ ] Define minimum audit schema for PHI access and updates.
- [ ] Expand audit logs to include critical read actions where appropriate.
- [ ] Add alerting for repeated failed logins, permission denials, and abnormal access patterns.
- [ ] Define retention period for audit logs and secure export procedure.

### F. Data protection controls
- [ ] Classify fields by sensitivity (PHI, credentials, operational).
- [ ] Choose field-level encryption targets (example: SSN if ever added, notes if required by policy).
- [ ] Define key hierarchy and rotation strategy.
- [ ] Document backup encryption and restore access controls.

### G. Compliance operations
- [ ] Create incident response runbook.
- [ ] Create breach notification checklist and timeline.
- [ ] Document minimum-necessary access policy by role.
- [ ] Add onboarding/offboarding access checklist.

## Recommended Deliverables for End of Phase 1

1. Security architecture decision record (database, hosting, key management).
2. Vendor and BAA matrix.
3. Data flow diagram and data classification table.
4. Baseline hardening PRs (headers, rate limits, auth protections).
5. Audit-log coverage matrix and gap list.
6. Incident response and breach response runbooks.

## Suggested Execution Order

Week 1
- Vendor and BAA matrix
- Data flow mapping
- Production database decision

Week 2
- Security headers and rate limiting
- Auth hardening and lockout rules
- Secrets rotation and environment policy

Week 3
- Audit coverage expansion plan
- Monitoring and alerting baseline
- Incident/breach runbooks

## Ready-to-Start Technical Tasks in This Repo

When you approve, the first implementation PR can include:
- Security headers in Next config.
- Shared authorization guard utilities for API routes.
- Rate limiting for auth and password reset endpoints.
- Audit event helper to standardize write events.

This keeps scope controlled and prepares the backend for secure database migration and deeper HIPAA controls in Phase 2.
