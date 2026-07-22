# Phase 1 Implementation Tracker

Source plan: [PHASE1_HIPAA_SECURITY_AUDIT.md](PHASE1_HIPAA_SECURITY_AUDIT.md)

## Sprint A: Baseline hardening (low risk)

- [x] Add baseline security headers in Next config.
- [x] Add reusable API rate-limit utility.
- [x] Rate limit login endpoint POST.
- [x] Rate limit forgot-password endpoint POST.
- [x] Rate limit reset-password endpoint POST.

## Next recommended items

- [x] Add shared authorization guard helpers and adopt in highest-risk APIs.
- [x] Add request logging correlation id for API responses.
- [x] Add minimal audit helper wrapper to standardize action names and metadata.
- [x] Add dependency vulnerability scanning task and CI check.
- [x] Add documented production secrets rotation checklist.

Completed deliverable:
- [PHASE1_SECRETS_AND_INCIDENT_RUNBOOK.md](PHASE1_SECRETS_AND_INCIDENT_RUNBOOK.md)

## Notes

- Current rate limiter is in-memory process-local for quick hardening.
- For production, move to shared backing store (Redis or managed equivalent) for multi-instance accuracy.
- Strict-Transport-Security is effective only over HTTPS and should remain enabled in production.
