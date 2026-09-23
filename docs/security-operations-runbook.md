# Security operations runbook

## Secret rotation

Rotate one credential at a time: Supabase secret/service-role key, database password and pooler URLs, Google OAuth client secret, Cron secret, Turnstile secret, payment-provider secrets, then any AI-provider keys. Update Production and Preview environment variables, redeploy, run authenticated smoke tests, and only then revoke the old credential. Never place secret values in Git, screenshots, logs, or audit metadata.

Rotation frequency: immediately after suspected exposure or staff departure; otherwise every 90 days for application secrets and every 180 days for OAuth/database credentials. Record only secret name, operator, timestamp and deployment ID in the audit log.

## Recovery target and test

Targets are RPO 15 minutes and RTO 60 minutes. Monthly: verify a recent physical backup exists, restore it to an isolated recovery project, validate tenant/user counts and tenant-isolation tests, verify Storage separately because database backups do not include Storage objects, and destroy the isolated recovery environment after recording results. Never run a restore drill against production.

## Incident session revocation

Disable the affected public user profile, globally revoke Supabase refresh-token sessions, mark matching `user_sessions` inactive, rotate exposed credentials, review immutable audit logs, and restore access only after Google identity and MFA factors are re-verified. Access JWTs can remain valid until expiry, so sensitive endpoints must continue validating database profile status and AAL2 on every request.
