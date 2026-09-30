# Firebase → Supabase ETL

This directory contains the reproducible data pipeline. It never deletes Firebase source data.

## Secrets

- Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service-account JSON outside the repository.
- Set `SUPABASE_DB_URL` only in the migration environment.
- Never commit exports, credentials, password hash parameters or database URLs.

## Pipeline

```bash
npm ci --prefix scripts/firebase-to-supabase
node scripts/firebase-to-supabase/export-firestore.mjs migration-data/raw/firestore.jsonl
node scripts/firebase-to-supabase/preflight.mjs migration-data/raw/firestore.jsonl migration-data/reports/preflight.json scripts/firebase-to-supabase/console-baseline.json
node scripts/firebase-to-supabase/preflight-auth.mjs migration-data/raw/firestore.jsonl migration-data/raw/firebase-auth.json migration-data/reports/auth-preflight.json
node scripts/firebase-to-supabase/transform.mjs migration-data/raw/firestore.jsonl migration-data/auth-map.json migration-data/normalized
node scripts/firebase-to-supabase/import-postgres.mjs migration-data/normalized
node scripts/firebase-to-supabase/reconcile.mjs migration-data/normalized migration-data/reports/reconciliation.json
```

Auth users are migrated first using Supabase's official Firebase Auth migration tool and Firebase SCRYPT parameters. Produce `migration-data/auth-map.json` as a JSON object from Firebase UID to Supabase Auth UUID before transforming Firestore data.

Every run writes deterministic JSONL and SHA-256 manifests. Preflight errors and unresolved owners are fatal by default. Console-baseline drift is a warning because production may legitimately change after the observation timestamp; the final freeze/export count becomes authoritative.
