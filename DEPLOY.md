# ClearCondo — Deploy Guide

Ordered steps to take this from the repo to a live Vercel deployment.
Steps marked **[UNVERIFIED]** could not be tested here (no API keys, no
Vercel account in this environment). Verified 2026-10-18 on branch
`verify/pre-submission` — see `VERIFICATION.md` for the full 40-check report.

## 0. What you need before you start

| # | Account | Why | Where |
|---|---------|-----|-------|
| 1 | Clerk | Sign-in / sign-up, protects `/app/*` | https://dashboard.clerk.com |
| 2 | Anthropic | Claude analysis + scanned-PDF OCR | https://console.anthropic.com |
| 3 | SurrealDB Cloud | Report persistence, building memory | https://surrealdb.com/cloud |
| 4 | SurrealDB Agent Memory | Belief layer (optional, prize-targeted) | SurrealDB Studio → your org → Contexts |
| 5 | Stripe | Report credits (optional, test mode) | https://dashboard.stripe.com/test/apikeys |
| 6 | Vercel | Hosting + cron | https://vercel.com |

No account needed to preview: `/`, `/demo`, and `/privacy` render with zero
env vars (verified locally — landing 200, demo 200 with sample report +
disclaimer, `/api/health` 200 `"status":"degraded"`).

## 1. Create the accounts & collect keys

### 1a. Clerk (required for `/app/*`)
1. dashboard.clerk.com → create app (Development instance is fine).
2. API Keys → copy **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Copy **Secret key** → `CLERK_SECRET_KEY`.
4. No code changes needed; `/sign-in`, `/sign-up`, and `proxy.ts` are wired.
   Without these keys the app still renders but `/app/*` shows a setup
   notice (verified).

### 1b. Anthropic (required for real analyses)
1. console.anthropic.com → API Keys → create key → `ANTHROPIC_API_KEY`.
   This key pays for every analysis — keep it in Vercel env vars, never in
   chat or code. Typical cost ≈ $0.06–0.13 per report (worst case ≈ $0.54).
2. Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-4-5-20250929`).
   ⚠️ That model **retires 2026-11-30** — plan to switch to
   `claude-sonnet-5-5` and re-run `npm run eval` before then (see
   VERIFICATION.md open issue #1).
3. Optional: `ANTHROPIC_TIMEOUT_MS` (default 240000).

### 1c. SurrealDB Cloud (required for persistence/history)
1. surrealdb.com/cloud → create an instance (free tier works).
2. Connection URL, e.g. `wss://<instance-id>.surreal.cloud/rpc` →
   `SURREAL_URL`.
3. `SURREAL_NS=clearcondo`, `SURREAL_DB=prod` (any values; schema from
   `lib/schema.surql` applies automatically on first connect).
4. Auth — EITHER `SURREAL_USER` + `SURREAL_PASS` (root or a scoped user you
   create) OR `SURREAL_TOKEN`.

### 1d. SurrealDB Agent Memory (optional)
1. SurrealDB Studio → your org → **Contexts** → create a context (name +
   region). **[UNVERIFIED — no access here]**
2. Open the context → **API keys** → create a key (copy once).
3. `SPECTRON_URL` = the exact host shown in Studio, `SPECTRON_CONTEXT_ID`,
   `SPECTRON_API_KEY`.
4. Without these the app works exactly as before (deterministic tables only).

### 1e. Stripe (optional, TEST MODE ONLY)
1. Keep `STRIPE_ENABLED=false` (default) for beta-free mode.
2. To enable: dashboard.stripe.com/test/apikeys → `STRIPE_SECRET_KEY`
   (**test** key, `sk_test_…`), create a webhook endpoint →
   `https://<your-app>/api/stripe/webhook` listening to
   `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`, then
   `STRIPE_ENABLED=true`. Price via `STRIPE_REPORT_PRICE_CENTS` (default
   4900 = $49 CAD).
3. The code now **refuses non-`sk_test_` keys** (`lib/stripe.ts` fail-closed;
   verified by unit tests). Real-money charges are impossible by
   construction — but still double-check the key prefix before enabling.

## 2. Environment variables (complete list)

Cross-checked 2026-10-18: every `process.env.*` read in `lib/`, `app/`,
`components/`, and `e2e/` appears in `.env.example` (only `NODE_ENV`,
Vercel's automatic `VERCEL_URL`, and eval-only `EVAL_MIN_RECALL` are absent —
none needed for deploy).

| Var | Required? | Where to get it |
|-----|-----------|-----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | for `/app/*` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | for `/app/*` | Clerk dashboard → API Keys |
| `ANTHROPIC_API_KEY` | for analyses | console.anthropic.com → API Keys |
| `ANTHROPIC_MODEL` | optional | default `claude-sonnet-4-5-20250929` (retires 2026-11-30) |
| `ANTHROPIC_TIMEOUT_MS` | optional | default 240000 |
| `OCR_CHUNK_PAGES` / `OCR_MAX_CONCURRENCY` / `OCR_CHUNK_TIMEOUT_MS` / `SCAN_TEXT_THRESHOLD_CHARS` | optional | tuning; defaults 10 / 4 / 120000 / 50 |
| `SURREAL_URL` | for persistence | SurrealDB Cloud instance |
| `SURREAL_NS` / `SURREAL_DB` | for persistence | your choice, e.g. `clearcondo` / `prod` |
| `SURREAL_USER` + `SURREAL_PASS` OR `SURREAL_TOKEN` | for persistence | SurrealDB Cloud |
| `SPECTRON_URL` / `SPECTRON_CONTEXT_ID` / `SPECTRON_API_KEY` | optional | SurrealDB Studio → Contexts |
| `RETENTION_DAYS` | optional | default 30 |
| `CRON_SECRET` | for retention cron | generate: `openssl rand -hex 32` |
| `MAX_ANALYSES_PER_DAY` | optional | default 10 (beta cost guard; DB-backed) |
| `MAX_PAGES_PER_RUN` | optional | default 480 (stateless run-payload cap) |
| `STRIPE_ENABLED` | optional | `false` default; `true` to enable |
| `STRIPE_SECRET_KEY` | if Stripe on | Stripe dashboard (**test** keys — enforced) |
| `STRIPE_WEBHOOK_SECRET` | if Stripe on | Stripe webhook endpoint |
| `STRIPE_REPORT_PRICE_CENTS` | optional | default 4900 |
| `NEXT_PUBLIC_APP_URL` | recommended | your production URL, e.g. `https://clearcondo.vercel.app` |

## 3. Vercel import

1. Push the repo to GitHub (public repo required for the hackathon).
2. vercel.com → Add New Project → Import the repo. Framework preset: Next.js.
   No build-setting changes needed.
3. Project → Settings → Environment Variables → add the vars from the table
   above. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy.

## 4. Cron setup

`vercel.json` already declares it — no dashboard setup needed beyond deploy:

```json
{ "crons": [{ "path": "/api/retention/cleanup", "schedule": "0 4 * * *" }] }
```

Daily 04:00 UTC run of `GET /api/retention/cleanup`, which deletes extracted
page text + document rows older than `RETENTION_DAYS` (default 30). Auth:
Vercel sends `Authorization: Bearer <CRON_SECRET>`; the route returns **401**
when the secret is missing or wrong, and fails closed when `CRON_SECRET` is
unset. **[UNVERIFIED — cron execution not tested; verify in Vercel →
Project → Cron Jobs after first deploy.]**

## 5. Verify the deployment

1. `GET /api/health` → 200. With all keys set: `"status":"ok"` and every
   service `true`. (Verified locally in degraded mode: `"status":"degraded"`,
   all `false`.)
2. `GET /` → 200, landing page renders.
3. `GET /privacy` → 200, privacy & retention note renders.
4. `GET /demo` → 200, sample report renders with the "Sample data." banner,
   "13 of 13 claims verified", and the disclaimer section (verified locally).
5. `GET /app/new` without Clerk keys → 200 with the setup notice. With keys
   → sign-in wall.
6. Retention cron: after 24h, Vercel → Cron Jobs shows
   `/api/retention/cleanup` as successful. **[UNVERIFIED]**
7. End-to-end: sign in → `/app/new` → upload the demo PDFs from `demo-docs/`
   → report renders → "Delete this report" removes it.
   **[UNVERIFIED — needs Anthropic + Clerk + SurrealDB keys.]**

## 6. Playwright suite against the live URL

```bash
npx playwright install chromium   # once, on your machine (sandbox CDN fails)
npm run e2e                        # against local dev server
BASE_URL=https://<your-app>.vercel.app npm run e2e   # against production
```

Specs live in `e2e/` and read `process.env.BASE_URL ?? "http://localhost:3000"`:
landing + link crawl, `/demo` zero-key render, auth gating, IDOR probes,
consent enforcement. **[UNVERIFIED — could not run here; Chromium download
fails in this sandbox.]**

## 7. Remaining gaps after verification (from VERIFICATION.md)

1. **Model retirement 2026-11-30** — switch `ANTHROPIC_MODEL` to
   `claude-sonnet-5-5` and re-run `npm run eval` before then.
2. **Name-redaction heuristic** leaks 14 formats on adversarial input
   (ALL-CAPS, `LAST, FIRST`, first-name-only, emails, diacritics…); the
   dangerous API/Flight leak is fixed, these are UI-text leaks.
3. Run `npm audit` on an open network before deploy (was blocked here).
4. No `loading.tsx`/`error.tsx`/`not-found.tsx` under `app/` (Next defaults
   apply); `AgentMemoryPanel` is silent on failure.
5. Daily rate limit is read-then-write (tiny race) and needs SurrealDB.
6. Probable mobile header overflow at 375px — needs a visual check.

## 8. Manual file uploads

**None.** All 13 demo PDFs + `app/favicon.ico` are already committed as real
blobs (verified via `git ls-tree`). Nothing to upload via the GitHub web UI.
