# Phase 1 Production Secrets Rotation and Incident Runbook

Scope: Operations checklist for production secret hygiene and security incident handling.

## 1. Environment and Secret Ownership

### Environment tiers
- Local: developer workstation only, synthetic/test data only.
- Staging: production-like controls, no live PHI unless explicitly approved.
- Production: live PHI, strict access controls, full audit requirements.

### Secret categories
- Authentication: `NEXTAUTH_SECRET`.
- Database: `DATABASE_URL` and related credentials.
- Payment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Notification providers: SMS/email provider API keys (when enabled).
- Infrastructure: cloud provider/API tokens, CI deploy tokens.

### Ownership
- Security owner: accountable for policy and approvals.
- Platform owner: executes rotations and deployment changes.
- On-call owner: emergency rotation executor.

## 2. Rotation Policy

### Standard cadence
- Critical secrets: every 90 days.
- Medium-risk secrets: every 180 days.
- Immediately rotate on:
  - suspected compromise,
  - employee/contractor offboarding with privileged access,
  - vendor breach notice,
  - accidental disclosure in logs/chat/code.

### Rotation pre-checklist
- [ ] Change ticket created and approved.
- [ ] Secret has named owner.
- [ ] Rollback plan documented.
- [ ] Maintenance window identified if needed.
- [ ] Validation checklist prepared.

## 3. Rotation Execution Playbook

### Planned rotation steps
1. Generate new secret in the managed secret store.
2. Update staging environment first.
3. Deploy and validate staging health checks.
4. Update production secret.
5. Deploy production.
6. Validate key flows:
   - login,
   - password reset,
   - patient status,
   - payment checkout + webhook,
   - provider/pharmacy queue updates.
7. Revoke old secret once validation passes.
8. Record completion evidence (ticket, timestamp, actor, verification output).

### Emergency rotation steps
1. Trigger incident and assign incident commander.
2. Immediately disable/revoke compromised secret.
3. Generate replacement secret.
4. Update production and restart affected services.
5. Verify customer-facing and admin-critical flows.
6. Review logs for suspicious access during exposure window.
7. Document incident timeline and remediation actions.

## 4. Verification Checklist

- [ ] All app instances load updated secrets.
- [ ] No authentication failures spike post-rotation.
- [ ] Stripe checkout and webhook signatures succeed.
- [ ] Database connectivity stable.
- [ ] Audit logs capture actor and request id for changes.
- [ ] Monitoring alerts normal after deployment window.

## 5. Incident Response Runbook

### Severity levels
- Sev 1: confirmed PHI exposure or active compromise.
- Sev 2: suspected compromise without confirmed data impact.
- Sev 3: security control degradation with no known exposure.

### Response workflow
1. Detect and triage.
2. Contain affected systems and credentials.
3. Eradicate root cause.
4. Recover services safely.
5. Post-incident review and corrective actions.

### Triage checklist
- [ ] Capture request ids, timestamps, affected endpoints.
- [ ] Identify impacted users/records and data types.
- [ ] Confirm whether PHI was accessed, altered, or exfiltrated.
- [ ] Preserve evidence (logs, audit records, deployment diffs).

### Containment checklist
- [ ] Rotate compromised secrets.
- [ ] Restrict privileged access temporarily.
- [ ] Disable suspicious sessions/tokens.
- [ ] Apply temporary WAF/rate-limit rules if needed.

### Recovery checklist
- [ ] Validate business-critical workflows.
- [ ] Confirm audit and monitoring are functioning.
- [ ] Notify stakeholders per escalation policy.
- [ ] Prepare breach-notification assessment package.

## 6. Evidence and Compliance Records

Retain the following artifacts per rotation/incident:
- change ticket id,
- approver and executor,
- exact timestamp window,
- secret scope impacted,
- verification results,
- rollback action (if used),
- post-incident corrective actions.

## 7. Repo-Specific Operational Notes

- Security scan workflow: [.github/workflows/security-scan.yml](.github/workflows/security-scan.yml)
- Dependency audit scripts: [package.json](package.json)
- Correlation id middleware: [middleware.ts](middleware.ts)
- API structured logging helper: [lib/apiLogging.ts](lib/apiLogging.ts)
- API auth guards: [lib/apiAuth.ts](lib/apiAuth.ts)
- Audit write helper: [lib/auditLog.ts](lib/auditLog.ts)

## 8. Immediate Follow-up Tasks

- [ ] Add vendor and BAA matrix document.
- [ ] Add data classification matrix for PHI and operational fields.
- [ ] Add breach notification legal workflow with counsel review.
- [ ] Add on-call escalation contact list and pager process.
