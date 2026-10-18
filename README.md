# ClearCondo

**Know what you're buying before you buy it.** ClearCondo reads a condo's
document stack — reserve fund study, bylaws, board/AGM minutes, information
statements — and produces a red-flag report for buyers: severity-grouped
flags, verbatim evidence quotes with source documents, dollar exposures, and
questions to take to a realtor or lawyer.

Built for **Build North 2026** (Georgian). This is a real product, not a demo
throwaway: per-report Stripe monetization (test mode), Clerk auth, and a
SurrealDB building-memory layer where every analysis accumulates.

## Architecture

```
Upload (PDFs)
  → /api/analyze/start → per-page text extraction (unpdf, server-side)
                         scanned/image-only PDFs → Claude native-PDF OCR
                         transcription (per-page JSON, zod-validated)
                         missing-documents check (Alberta resale checklist)
  → /api/analyze/run   → Claude Messages API, strict JSON contract
                         (flags + structured facts, file_id/page/verbatim
                         evidence), validated by zod (one repair retry)
                       → VERIFY every cited quote against stored page text
                         (exact page → exact file → fuzzy ≥0.9); unverified
                         claims downgraded, money figures stripped
                       → SurrealDB persist (building/document/report/flag +
                         facts_snapshot)
                       → diff vs previous snapshot ("what changed")
                       → report page
```

- **Two-step pipeline** so the UI shows real progress (extracting → analyzing)
  and Vercel's serverless timeout is never a blank screen. Both analyze routes
  set `maxDuration = 60`.
- **Building memory (the SurrealDB story):** buildings are deduped per user;
  every report's flags link to both their report *and* their building with
  provenance (source doc + verbatim quote). On repeat uploads, prior flags are
  fed back into the analysis prompt as "building memory" so the model notes
  what is new, persisting, or resolved. `/app/buildings/[id]` shows the
  accumulated memory: every report, every distinct issue, first-seen dates.
- **Graceful degradation:** without `ANTHROPIC_API_KEY`, `/api/analyze/run`
  returns a clear "add your key" state; without SurrealDB, reports render
  ephemerally; without Clerk keys, `/app/*` shows a setup notice. `/demo`
  always works — it renders a hand-written `sample-data/sample-report.json`.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in keys (see checklists below)
npm run dev                  # http://localhost:3000
npm run smoke                # PDF extraction smoke test (no LLM needed)
npm run build                # must pass before deploy
```

## Setup checklists

### 1. Clerk (auth) — required for /app/*
1. Create an app at https://dashboard.clerk.com (Development instance is fine).
2. API Keys → copy **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Copy **Secret key** → `CLERK_SECRET_KEY`.
4. No code changes needed; sign-in/sign-up pages are wired.

### 2. Anthropic (AI analysis) — required for real analyses
1. https://console.anthropic.com → API Keys → create key → `ANTHROPIC_API_KEY`.
2. Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-4-5-20250929`).
3. The user holds their own key (incl. the $100 hackathon credit) — paste it
   into the deploy environment, never into chat or code.

### 3. SurrealDB Cloud (building memory) — required for persistence/history
1. https://surrealdb.com/cloud → create an instance (free tier works).
2. Note the connection URL, e.g. `wss://<instance-id>.surreal.cloud/rpc` → `SURREAL_URL`.
3. Set `SURREAL_NS=clearcondo`, `SURREAL_DB=prod` (any values work; schema is
   applied automatically on first connect from `lib/schema.surql`).
4. Authentication — either:
   - `SURREAL_USER` + `SURREAL_PASS` (root, or a scoped user you create), or
   - `SURREAL_TOKEN` (a record/token string).
5. Verify: run an analysis; the building should appear under /app/buildings.

### 4. Stripe (test mode) — optional, behind a flag
1. Keep `STRIPE_ENABLED=false` (default) for beta-free mode — the demo never
   blocks on payment.
2. To enable: https://dashboard.stripe.com/test/apikeys → `STRIPE_SECRET_KEY`
   (test key), create a webhook endpoint pointing at
   `https://<your-app>/api/stripe/webhook` listening to
   `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`, then set
   `STRIPE_ENABLED=true`. Price via `STRIPE_REPORT_PRICE_CENTS` (default 4900).

## Deploy to Vercel

1. Push this repo to GitHub (public repo required for the hackathon).
2. https://vercel.com → Add New Project → import the repo. Framework preset:
   Next.js. No build-setting changes needed.
3. Project → Settings → Environment Variables: add the vars from `.env.example`
   (at minimum the Clerk + Anthropic + SurrealDB sets above). Set
   `NEXT_PUBLIC_APP_URL` to your production URL.
4. Deploy. The `proxy.ts` (Next 16's middleware convention) protects `/app/*`
   via Clerk; `/`, `/demo`, and `/api/stripe/webhook` stay public.

## SurrealDB schema

`lib/schema.surql` (applied automatically on first connection):

| Table      | Purpose |
|------------|---------|
| `building` | One row per condo corp per user (`dedupe_key` unique on owner + corp/name) |
| `document` | Each uploaded PDF → `building`, filename, type, page/char counts |
| `report`   | Each analysis → `building`, summary, exposure total, questions, model, facts |
| `flag`     | Each red flag → `report` **and** `building`, severity, evidence quotes, money exposure |
| `credit`   | Stripe report-credit balance per user |

## Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/` | — | Landing page |
| `/demo` | — | Hand-written sample report (labeled as sample) |
| `/sign-in`, `/sign-up` | — | Clerk |
| `/app` | ✓ | Dashboard: my reports |
| `/app/new` | ✓ | Upload + two-step analysis flow |
| `/app/reports/[id]` | ✓ | Red-flag report |
| `/app/buildings` | ✓ | Buildings with memory |
| `/app/buildings/[id]` | ✓ | Building history: accumulated flags + report timeline |
| `POST /api/analyze/start` | ✓ | PDF → per-page text (+OCR fallback, missing-docs check) |
| `POST /api/analyze/run` | ✓ | Text → Claude → verify → SurrealDB → report + deltas |
| `GET /api/buildings/match` | ✓ | Building candidates for confirm/merge on upload |
| `GET /api/checkout` | ✓ | Stripe Checkout (flag-gated) |
| `POST /api/stripe/webhook` | — | Credit fulfillment |
| `GET /api/me/credits` | ✓ | Credit balance |

## Prior work disclosure (for Devpost)

Per the Build North rules, everything below was created **during** Build Week
(Oct 16–25, 2026). Nothing existed before Oct 16 except the idea:

- **Before Oct 16:** the ClearCondo concept only. No code, no scaffold, no
  repository.
- **Oct 18, 2026 (during Build Week):** the demo document pack — one
  third-party public sample reserve fund study (M3 Consulting, Alberta —
  their own publicly posted marketing sample) plus synthetic fictional condo
  documents generated with `demo-docs/generate_demo_docs.py` (a 2026 set with
  six baked-in red flags, and a 2024 set with different numbers for the
  memory-diff demo). Full origin/licence notes in `demo-docs/SOURCES.md`.
- **Oct 18, 2026 (during Build Week):** the entire application — Next.js app,
  per-page extraction, OCR fallback, evidence verification, structured facts,
  memory diffs, SurrealDB schema, UI, tests.

## Data disclosure (for Devpost)

- **Real/public:** `m3-sample-reserve-fund-study.pdf` — M3 Consulting's own
  publicly posted sample reserve fund study, used only to sanity-check
  extraction against a genuine third-party document.
- **Synthetic:** every other demo PDF and both `sample-data/sample-report-*.json`
  files — fictional "North Hill Terrace" building, generated Oct 18, 2026.
  Every synthetic page is watermarked "SAMPLE DOCUMENT — DEMO DATA ONLY".
  The `/demo` page renders two hand-verified sample reports (2024 + 2026)
  whose every quote was machine-verified against the synthetic PDFs
  (`scripts/enrich-sample.mjs` fails loudly on any unverified quote).
- **User uploads:** processed in memory and stored per the user's own
  SurrealDB; document contents are never logged.

## Disclaimer

ClearCondo summarizes condominium documents. It is not legal, financial, or
real-estate advice. Always have a qualified lawyer review the actual documents
before buying.
