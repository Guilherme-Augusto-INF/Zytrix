# 19 — Secrets and environment audit

Audit date: 2026-09-21.

## Repository and history

| Check | Result |
|---|---|
| Supabase `service_role`/secret key in current browser code | PASS — no match |
| Supabase JWT-like secret in tracked history | PASS — no match found |
| Firebase public web API key | Present in `assets/js/firebase.js`; expected public client configuration, not an admin credential |
| Service-account filenames | Ignored by `.gitignore` |
| Raw migration exports | `migration-data/` ignored by `.gitignore` |
| Database URL/secrets in ETL | Environment-only (`SUPABASE_DB_URL`, `GOOGLE_APPLICATION_CREDENTIALS`) |

The static test `browser modules never contain a Supabase secret/service-role key` is part of `npm test` and currently passes.

## Vercel

- Project `zytrix-web` is connected and production is READY.
- Runtime is Node.js 24.x.
- Production domains are known and the latest production deployment was inspected through the connected integration.
- The available integration did not expose environment-variable names or values. Therefore the Vercel environment secret audit is **NOT VERIFIED**, not PASS.

Before preview migration, inspect Vercel environment scopes and confirm:

1. public Supabase URL/publishable key only in browser-visible configuration;
2. no Supabase secret/service-role key in any `NEXT_PUBLIC_*`, `VITE_*` or static build variable;
3. Firebase configuration retained during dual-run;
4. preview and production values separated;
5. any exposed privileged credential rotated before further migration work.

## Rotation decision

No exposed Supabase privileged credential was found in the repository/history, so no rotation incident is currently declared. Vercel remains an explicit verification gate.
