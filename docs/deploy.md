# Deploying Asimov

Two environments, each with its own database branch and its own Render services:

| | Staging | Production |
|---|---|---|
| Git branch | `staging` (deploys automatically) | `main` (deploys when you press the button) |
| Render | `asimov-api-staging`, `asimov-worker-staging` | `asimov-api-production`, `asimov-worker-production` |
| Neon | the `staging` branch | the primary branch |

Order: **staging first, smoke test, then production, smoke test.**

## Environment variables (set in Render for each service, never in the repo)

| Variable | Web | Worker | Secret? | Where the value comes from |
|---|---|---|---|---|
| `DATABASE_URL` | yes | yes | **yes** | Neon, that environment's branch, **pooled** address |
| `DIRECT_URL` | yes | yes | **yes** | Neon, same branch, **direct** address (used for migrations and the job queue) |
| `SUPABASE_URL` | yes | | no | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | | **yes** | Supabase API keys (the secret key) |
| `CORS_ORIGINS` | yes | | no | The frontend address for that environment, no trailing slash. Several are allowed, separated by commas. |
| `R2_ACCOUNT_ID`, `R2_BUCKET` | yes | | no | Cloudflare R2. Use a **separate bucket per environment**. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes | | **yes** | Cloudflare R2 API token |
| `RESEND_API_KEY` | | yes | **yes** | Resend, API Keys |
| `RESEND_FROM_ADDRESS` | | yes | no | An address on the verified domain |
| `APP_BASE_URL` | | yes | no | The frontend address for that environment |
| `NODE_ENV`, `NODE_VERSION`, `TRUST_PROXY` | | | no | Already in `render.yaml` |
| `RUN_WORKERS` | local only | | no | `true` in a local `.env` only. Never set it on Render. |

`PORT` is set by Render automatically.

Both services refuse to start in production if a required value is missing or malformed, and the log lists the **names** that are wrong, never the values.

## Releasing
1. Merge to `staging`. Render builds, runs `prisma migrate deploy`, starts the API and the worker.
2. Smoke test: `npx tsx scripts/smoke.ts https://<staging-api-address> --origin https://<staging-frontend-address>`
3. Merge `staging` into `main`. In Render open `asimov-api-production` and `asimov-worker-production`, and press Manual Deploy, Deploy latest commit.
4. Smoke test production the same way.

## Rolling back
Render keeps previous deploys: open the service, Events, and roll back to the last good deploy.
Migrations only go forward and are never edited: fix a bad migration with a new migration.

## Notes
- pg-boss polls the database all day, so the Neon compute stays awake. Check your Neon plan's compute limit. Suspend the staging worker when you are not testing.
- A new Neon branch is a **copy** of its parent, including the `pgboss` job tables and any pending notifications. Before starting a worker on a new staging branch, clear them (see the steps in the AS-122 walkthrough).
- If rate limiting hits every user at once, the proxy setting is wrong: raise `TRUST_PROXY` to `2`.