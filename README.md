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
Upload (PDFs, 4 MB total — Vercel request-body cap)
  → /api/analyze/start → per-page text extraction (unpdf, server-side)
                         scanned/image-only PDFs → Claude native-PDF OCR
                         transcription in page-range chunks (10 pages/chunk,
                         up to 4 concurrent, per-page JSON, zod-validated)
                         missing-documents check (Alberta resale checklist)
  → /api/analyze/run   → Claude Messages API, strict JSON contract
                         (flags + structured facts, file_id/page/verbatim
                         evidence), validated by zod (one repair retry)
                       → VERIFY every cited quote against stored page text
                         (exact page → exact file → fuzzy ≥0.9); unverified
                         claims downgraded, money figures stripped
                       → SurrealDB persist (building/document/report/flag +
                         facts_snapshot)
                       → remember verified facts in SurrealDB Agent Memory
                         (best-effort, never fails the request)
                       → diff vs previous snapshot ("what changed")
                       → report page
```

- **Two-step pipeline** so the UI shows real progress (extracting → analyzing)
  and Vercel's serverless timeout is never a blank screen. Both analyze routes
  set `maxDuration = 300` (the Vercel Hobby/Fluid maximum). Claude calls carry
  their own abort timeouts (analysis 240s, OCR chunk 120s — both env-tunable),
  and timeouts surface as a clear "timed out, try again" state in the UI,
  never a stuck spinner.
- **Building memory (two layers):**
  1. **Deterministic tables** (this schema): buildings are deduped per user;
     every report's flags link to both their report *and* their building with
     provenance (source doc + verbatim quote). On repeat uploads, prior flags
     are fed back into the analysis prompt as "building memory" so the model
     notes what is new, persisting, or resolved. `/app/buildings/[id]` shows
     the accumulated memory: every report, every distinct issue, first-seen
     dates. Every number the UI shows comes from these tables.
  2. **SurrealDB Agent Memory** (`lib/agent-memory.ts`, env-gated): after each
     persist, the verified facts are *remembered* as factual text with
     `infer: "full"` — the service extracts entities/attributes/relations
     itself, reconciles them against what it already believes about the
     building, and end-dates superseded beliefs instead of overwriting them
     (tri-temporal history). The building page recalls them with hybrid
     retrieval (`AgentMemoryPanel`). This is the "Best Use of SurrealDB Agent
     Memory" story: the tables are the auditable record, Agent Memory is the
     belief layer that reasons over time. Partitioning uses labels
     (`app=clearcondo`, `owner=…`, `building=…`) so no scope pre-registration
     is needed; everything degrades gracefully when `SPECTRON_*` is unset.
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
2. Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`; adaptive
   thinking on by default, billed as output).
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

### 4. SurrealDB Agent Memory (belief layer) — optional, prize-targeted
1. Sign in to SurrealDB Cloud → open your org in SurrealDB Studio →
   **Contexts** → create a context (name + region). Requires Agent Memory
   access on your profile.
2. Open the context → **API keys** → create a key; copy the secret once.
3. Set `SPECTRON_URL` (the exact host shown in Studio), `SPECTRON_CONTEXT_ID`,
   and `SPECTRON_API_KEY` in the deploy environment.
4. No scope pre-registration needed: writes are partitioned by labels
   (`app=clearcondo`, `owner=…`, `building=…`) and land in the key's default
   write region. Verify: run an analysis, then open the building page — an
   "Agent memory" section with recalled beliefs should appear below the
   deterministic building memory.

### 5. Stripe (test mode) — optional, behind a flag
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

### Vercel limits & measured budgets

Platform limits (Vercel Hobby with Fluid compute, checked Oct 2026 —
[changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)):

| Limit | Value | What we do about it |
|---|---|---|
| Function max duration | 300s (Hobby max) | Both analyze routes set `maxDuration = 300`; Claude calls abort earlier (240s analysis, 120s OCR chunk) so timeouts are ours, with clear errors |
| Request/response body | 4.5 MB | Total upload capped at 4 MB in `/api/analyze/start` (clear 413 message); run-route responses are bounded by the 1200-page payload cap |

Measured on the demo stack (`node --experimental-strip-types scripts/measure-pipeline.mjs`;
17 pages / 23.7k chars; Claude numbers are token-math estimates, no API key in CI):

| Stage | Measured | 100-page text stack (150k chars, extrapolated) |
|---|---|---|
| PDF text extraction | 24 ms/page | ~2.4s |
| Evidence verification | 0.2 ms/quote | <0.1s |
| Claude analysis (~42k in-tokens, ≤8k out incl. thinking) | — | ~30–90s (estimate) |
| DB persist | — | <2s (assumed) |
| **Total, sync** | — | **well under the 300s budget** |

Cost (Sonnet 5.5 list pricing: $2 / $10 per MTok input/output, checked Oct 2026;
thinking tokens bill as output):

| Stack | Input | Output | ≈ Cost |
|---|---|---|---|
| Demo stack (17 pp, 23.7k chars) | ~10k tok | ~8k tok | **≈ $0.10** |
| 100-page text stack (150k chars) | ~42k tok | ~8k tok | **≈ $0.16** |
| Worst case (12 files × 150k chars ≈ 450k tok) | ~450k tok | ~8k tok | **≈ $0.98** |

OCR transcription (scanned PDFs) is chunked: 10 pages/chunk, up to 8
concurrent (`OCR_CHUNK_PAGES`, `OCR_MAX_CONCURRENCY`). A 100-page scan is
~10 chunks ≈ 2 waves ≈ 1–2 min worst case — inside the 300s start-route
budget. Beyond that, the route returns a clear timeout error, not a silent
empty report.

**Background-job verdict:** not needed. The whole synchronous pipeline fits
in the 300s Hobby budget with margin for any stack the upload caps allow
(≤12 files, ≤100 pages/file, ≤150k chars/doc). The 240s analysis abort is
the hard guard: a worst-case 450k-token stack may approach it and get a
clear "timed out, try again" instead of ever hitting the 300s platform
limit. The upload caps — not a job queue — are the backpressure mechanism.
If stacks grow beyond that later, revisit.

**On timeout:** the UI shows "The analysis timed out — your files are fine"
with a Try again button. Persistence is sequential, not atomic: the run
route verifies after the Claude call, then writes the report, flags,
documents, and facts with individual statements. If an invocation is
killed mid-persist, a partial report can remain — re-running the analysis
creates a fresh, complete report.

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
| `DELETE /api/reports/[id]` | ✓ | Delete report + flags + documents (+ best-effort Agent Memory forget) |
| `GET /api/retention/cleanup` | cron secret | Daily retention cleanup (Vercel Cron) |
| `/privacy` | — | Plain-language privacy & retention note |

## Privacy & data retention

The full policy lives in one place: `lib/retention.ts` (the `RETENTION_POLICY`
table). Summary:

| Data | Retention | Why |
|------|-----------|-----|
| Raw PDF bytes | Never stored (memory only during extraction) | Minimizes sensitive data at rest |
| Extracted page text + document rows | Auto-deleted after `RETENTION_DAYS` (default 30) via daily Vercel Cron → `GET /api/retention/cleanup` (authorized by `CRON_SECRET`) | Bulk sensitive text; only needed for the verification audit window |
| Report shell (summary, flags, facts, verification stats) | Kept until the user deletes the report | The deliverable; never auto-deleted |
| Flags + evidence quotes | Kept with the report | Short excerpts the user already saw |
| Building row | Kept until its last report is deleted | Dedupe anchor; removed when empty |
| Agent Memory beliefs (hosted service) | Best-effort semantic forget on report delete; no auto-delete | The service exposes no bulk age-based purge (documented limitation) |

User-facing controls:

- **Upload consent:** required checkbox on the upload form ("I confirm I have
  the right to upload these documents…"), enforced client-side and
  server-side in both analyze routes (400 without it).
- **Delete this report:** bottom of every report page — two-step confirm,
  removes the report, its flags, its documents (metadata + page text), and
  the building shell when it was the last report. Clear success state, then
  redirects to the dashboard.
- **Privacy note:** `/privacy` page, linked from the footer, the landing
  page's "Your documents, your control" section, and the upload form.

Env vars: `RETENTION_DAYS` (default 30, max 3650, invalid values fall back to
the default), `CRON_SECRET` (generate with `openssl rand -hex 32`; Vercel
sends it as `Authorization: Bearer <CRON_SECRET>` on cron requests — the
route fails closed when unset).

## Eval: recall, fabrication, verification rate

`npm run eval -- <stack-dir> [--analysis <analysis.json>]` scores a produced
analysis against a hand-labeled eval case — no API key needed, because quotes
are re-verified against freshly extracted page text (never the `verified`
fields stamped on a stored report).

An eval case is a directory `eval/<stack-name>/` with two files:

- `case.json` — `{ "name", "docs_dir", "docs": ["a.pdf", ...], "analysis" }`
  (paths relative to the case dir). `docs_dir` points at the source PDFs;
  `analysis` points at a produced analysis JSON (a run output, the ephemeral
  `{analysis}` payload, or a checked-in sample report). `--analysis` overrides it.
- `expected.json` — `{ "flags": [...] }`, one entry per flag a correct report
  MUST contain. Each entry:

```json
{
  "id": "special-assessment-parkade",
  "severity": "critical",
  "title_keywords": ["special assessment", "parkade", "8,500"],
  "min_amount_cad": 714000,
  "evidence_quote": "BE IT RESOLVED that a special assessment of $8,500 per unit ...",
  "source_doc": "demo-02-agm-minutes-2026-04-22.pdf"
}
```

`title_keywords` (all must appear in the produced flag's title, normalized)
or a single `title` substring decides the match; each produced flag is matched
at most once, best keyword coverage wins. `min_amount_cad` is checked against
the flag's headline money figure (`amount_cad ?? per_unit_cad`).
`evidence_quote` is the labeler's canonical quote — it must itself verify
against `source_doc`, otherwise the case is flagged as stale.

Three metrics, printed with a per-flag table:

| Metric | Definition |
|--------|-----------|
| **recall** | expected flags matched / expected flags |
| **fabricated** | evidence quotes (flags + structured facts) that do NOT verify — hard fail if > 0 |
| **% verified** | verified quotes / total quotes in the analysis |

Exit code is 0 only when recall >= `EVAL_MIN_RECALL` (default 0.8) AND
fabricated quotes = 0. The committed case `eval/north-hill-terrace-2026`
is a **synthetic seeded case**: 7 hand-labeled flags scored against a
hand-written sample report and fictional demo PDFs (currently 100% recall,
0 fabricated, 100% verified). It proves the harness works — not that the
model finds real red flags.

### Eval on a hand-labeled REAL stack

To measure the real pipeline, label a genuine resale package by hand:

1. Put the real PDFs in a private folder that is **not** committed
   (`/private-samples/<building>/` — gitignored). Never commit real condo
   documents to this public repo.
2. Copy `eval/real-stack-template.json` to `eval/<stack-name>/expected.json`
   and fill it in. Create `eval/<stack-name>/case.json`:
   `{ "name", "docs_dir", "docs": [...], "analysis" }` — `docs_dir` and
   `analysis` may be absolute paths outside the repo.
3. Produce the analysis JSON: run the app's upload flow against the stack,
   then save the ephemeral `{ analysis }` payload from the
   `/api/analyze/run` response. **Label first, look later** — write the
   expected flags from your own reading of the PDFs *before* opening the
   produced analysis, so the eval measures the model instead of echoing it.
4. Run `npm run eval -- eval/<stack-name>` (no API key needed — quotes are
   re-verified against freshly extracted page text).
5. Keep the real-data case untracked (add `eval/<stack-name>/` to
   `.gitignore`) or keep it entirely outside the repo and pass its path.

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
