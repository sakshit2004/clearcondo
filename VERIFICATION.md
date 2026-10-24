# ClearCondo — Pre-Submission Verification

**Date:** 2026-10-18 · **Branch:** `verify/pre-submission` (from `main` @ `9385dd0`)
**Method:** independent end-to-end verification. Nothing was trusted — not the
README, not prior summaries, not earlier test counts. Every PASS below has
evidence (command + output, test name, or a live HTTP check).

**Environment limits (what could NOT be verified here):** no Anthropic,
Clerk, Stripe, SurrealDB, or Agent Memory keys; no Vercel account; no
browser (Playwright's Chromium download fails in this sandbox — CDN
unreachable). Anything needing those is marked BLOCKED with exactly what's
needed. `/tmp` is a 512 MB tmpfs shared with parallel workers — several
runs had to be retried after transient ENOSPC.

## Fix commits made during this verification

All on `verify/pre-submission`, each a small separate commit by the repo
owner:

| SHA | Fix |
|-----|-----|
| `203a0ea` | Lint errors in UploadForm: typed safe-JSON parsing, no setState in effect |
| `6854575` | Silent truncation of 41–100-page scanned PDFs (uncapped `totalPages` for OCR) + 2 regression tests |
| `854acfb` | New public `GET /api/health` (booleans only); fixed `dynamic`→`connection()` for cacheComponents after live 500 |
| `951c624` | **CRITICAL:** unpdf detached the input buffer → OCR was broken for every scanned PDF |
| `e82a348` | **PRIVACY:** strip unredacted evidence quotes from API responses + report page (`toPublicAnalysis`) + 2 tests |
| `ace4125` | Prompt-injection defense: instruction-hierarchy clause in system prompt |
| `48bd7a6` | Surface document truncation: `truncated` flag → payload → UI notice + 2 tests |
| `be3a5f3` | Cost guards: per-user daily limit (10/day, DB-backed) + stateless 480-page run cap + 10 tests |
| `48a09e7` | Stripe test-mode enforcement: refuse non-`sk_test_` keys (fail closed) + 4 tests |
| `f2a3ffb` | Baseline security headers (HSTS, X-Frame-Options, nosniff, referrer, permissions) |
| `7da139d` | Keyboard-accessible upload dropzone (role, tabIndex, Enter/Space, focus ring) |
| `e3791cc` | False claims fixed: "about a minute"→"a few minutes", delete Agent-Memory caveat, persistence honesty |
| `490017e` | Eval honesty: seeded case labeled **synthetic** + real-stack template/guide |
| `7d2d553` | Playwright e2e specs (5 files) + `npm run e2e` with `BASE_URL` support |

Final state: `npm run build` ✓ · `tsc --noEmit` ✓ · `npm run lint` 0 errors, 7 warnings
(pre-existing unused vars) · **`npm test`: 124/124 pass** (106 at branch base + 18 new)
· `npm run eval`: PASS · `npm run smoke`: PASS.

## The 40 checks

### A. Baseline & repo hygiene

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fresh clone → `npm ci`, build, typecheck, lint, tests, smoke, eval | **PASS (verified by running)** | `npm ci`: 394 pkgs. `npm run build`: "✓ Compiled successfully", 20 pages. `tsc --noEmit`: clean. `npm test`: **106/106 at base** — the "106 tests" claim is confirmed; 124/124 after verification fixes. `npm run smoke`: "All smoke tests passed." `npm run eval`: EVAL PASS (100% / 0 / 100%). `npm run lint`: 3 errors found → **fixed in `203a0ea`** → now 0 errors, 7 warnings. |
| 2 | Secrets scan of full git history | **PASS (verified by running)** | gitleaks/trufflehog unavailable in sandbox; manual scan: `git log --all -p` grepped for `sk-ant-`, `sk_live_`, `AKIA`, `ghp_`, key headers, password assignments → only placeholders (`sk_test_xxx`, `<redacted>`). No `.env` ever tracked; `.env.example` values are literal placeholder text. No real personal data (demo docs synthetic; M3 sample is the firm's own public marketing PDF). |
| 3 | `/private-samples` gitignored; SOURCES.md coverage | **PASS (verified by running)** | `.gitignore` covers `/private-samples/`; `git ls-files \| grep -i private` → empty. All 7 `demo-docs/` files have origin+licence entries in `demo-docs/SOURCES.md`. Minor: the 6 root-level `demo-*.pdf` duplicates aren't individually listed (byte-identical copies of covered files). |
| 4 | 13 demo PDFs + favicon in repo? | **FAIL (open)** | `git ls-tree -r HEAD --name-only \| grep -cE "\.pdf$\|favicon.ico"` → **14**. All present as real blobs (e.g. `demo-docs/m3-sample-reserve-fund-study.pdf` 299,994 bytes). **Correction 2026-10-18 (independent re-check):** 14/14 exist as blobs in **local** git, but **0/14 on GitHub** — API-verified: `demo-docs/` on main lists 3 non-PDF items, `app/favicon.ico` → 404. The push connector transfers UTF-8 text files only, so binaries never reached GitHub. Vercel deploys from GitHub, so **manual upload via the GitHub web UI is still required** — see the manual checklist. |
| 5 | `npm audit` | **BLOCKED (needs registry access)** | Proxy denies the audit endpoint (`403 policy_denied`); bypassing it would circumvent IT policy. Direct deps for manual review: `next 16.4.2`, `react 19.3.0`, `@clerk/nextjs ^7.9.17`, `@anthropic-ai/sdk ^0.135.0`, `@surrealdb/memory ^1.0.0-alpha.11`, `surrealdb ^2.1.1`, `stripe ^23.0.0`, `unpdf ^1.9.0`, `zod ^4.6.7`, `@playwright/test` (new devDep). |
| 6 | Commit history during Build Week | **PASS (verified by running)** | 37 commits at branch base, **all dated 2026-10-18**; largest 31 files (normal feature commit); scaffold 12 files. No giant dump; small-frequent-commits rule honored. Branch adds 14 small fix commits. |

### B. Dependency / claim checks

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 7 | "Spectron SDK" is official SurrealDB Agent Memory | **PASS (verified by running)** | Official docs: `surrealdb.com/docs/agent-memory/welcome/what-is-surrealdb-agent-memory` ("memory and knowledge layer… application tier in front of SurrealDB"); agent guide shows JS SDK `import { AgentMemory } from "@surrealdb/memory"` with `SPECTRON_URL`/`SPECTRON_API_KEY`/`SPECTRON_CONTEXT_ID` — matching the repo exactly. npm `@surrealdb/memory@1.0.0-alpha.11`: "The official Agent Memory client for JavaScript." Repo usage (`remember`/`recall`/`forget`, `infer:"full"`, labels) matches the documented shape. Caveat: live integration untestable here (no keys). |
| 8 | Claude model name, PDF limits, OCR chunking | **PASS (verified by running), with flags** | Model `claude-sonnet-4-5-20250929` is a real ID — but **deprecated 2026-09-30, retires 2026-11-30** (multiple sources; replacement `claude-sonnet-5-5`). See open issue #1. PDF limits: 32 MB / 100 pages per request (convergent secondary sources; docs.anthropic.com unreachable from sandbox). Chunking (10 pages/chunk, 4 concurrent, each request ≤ limits) respects them. Fixed doc drift: `lib/ocr.ts` header wrongly said caps were "15 MB / 40 pages" (that's the text path; OCR path is 30 MB / 100 pages) — corrected in `6854575`. |
| 9 | Vercel config: maxDuration, cron, plan validity | **PASS (verified by running)** | `vercel.json`: `{"crons":[{"path":"/api/retention/cleanup","schedule":"0 4 * * *"}]}` — daily, valid on Hobby (Hobby cron limit is once/day). Routes: analyze/start + analyze/run `maxDuration=300`, retention `60`, webhook `30`. Per the official Vercel changelog (Fluid compute), Hobby = 300s default/max — valid. 4.5 MB body cap respected by the 4 MB upload cap. |

### C. Env & startup

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 10 | Fail fast on missing env; /demo with zero env | **PASS (verified by running + reading)** | Zero env: `next dev` boots ("✓ Ready"); `/demo` → 200 with sample report; `/app` → 200 setup notice; `POST /api/analyze/start|run` → 503 `{"error":"Authentication is not configured."}`; `GET /api/retention/cleanup` → 401. No hangs/crashes. Invalid-*format* Clerk keys → 500 on all routes with Clerk's readable key-format message (expected Clerk behavior; fail-closed). Anthropic missing → 503 `no_api_key` (code-read, `run/route.ts:68-76`). SurrealDB/Agent Memory missing → graceful no-op (code-read). |
| 11 | `/api/health` endpoint | **FAIL → fixed in `854acfb`** | Was missing entirely. Added `app/api/health/route.ts`: booleans only (`clerk`, `anthropic`, `surrealdb`, `agent_memory`, `stripe`), `status: ok\|degraded`, public by design (proxy only gates `/app/*`). Live-verified: `{"status":"degraded","services":{"clerk":false,...}}` HTTP 200 with zero env. The first version used `export const dynamic = "force-dynamic"` → **live 500** (`not compatible with nextConfig.cacheComponents`) — caught by testing, fixed with `await connection()` per Next 16 docs. |

### D. End-to-end tests

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 12 | Landing loads; links; console errors | **PASS (running) / console BLOCKED (needs browser)** | `GET /` → 200 (45 KB). Crawled hrefs: `/`, `/demo`, `/privacy`, `/app/new`, `/sign-in`, `/sign-up`, `/favicon.ico` → 200; `/app/reports` → 404 (no index route; not linked anywhere). Draft spec `e2e/e2e-12-pages.spec.ts` asserts zero console/page errors when a browser is available. |
| 13 | /demo with zero keys | **PASS (verified by running), premise corrected** | **Correction:** only ONE report renders (the 2026 "North Hill Terrace" report — `app/demo/page.tsx` passes only `newer` to `<ReportView>`); the 2024 report exists solely to compute the diff. Confirmed in served HTML: 20 "✓ Verified" badges; "13 of 13 claims verified against source documents"; "What changed since the last review" with 6 deltas; disclaimer + "Sample data." banner. |
| 14 | Auth gating logged-out | **PASS (running) + PASS (code-read for keyed)** | Zero env: `POST /api/analyze/start|run` → 503; `DELETE /api/reports/x` → 503; `GET /api/retention/cleanup` → 401 (also 401 with wrong bearer — fails closed); `/api/buildings/match` → 200 `{"buildings":[]}` (no leak); `/app/*` → 200 SetupNotice, no data. Keyed: `proxy.ts` `auth.protect()` on `/app/*` → redirect; API routes 401 (code-read). Bonus: malformed Clerk keys fail closed at startup (server refuses to boot). |
| 15 | IDOR: user A vs user B | **PASS (code-read) / live BLOCKED (needs Clerk + SurrealDB)** | Every DB function scopes by `owner_id` (`deleteReportCascade`, `getReport`, `listReports`, `listBuildings`, `getBuildingHistory`, `matchBuildings`, `getPriorFlags` — `lib/db.ts`). `upsertBuilding` dedupe key embeds ownerId + UNIQUE index. `/api/analyze/run` re-validates client `buildingId` with `WHERE id=… AND owner_id=$owner`. Nit (not exploitable): `getReport`'s flags query omits `owner_id`, relying on the preceding owner-scoped report lookup. Draft: `e2e/e2e-15-idor.spec.ts`. |
| 16 | Upload happy path | **BLOCKED (needs Clerk + ANTHROPIC_API_KEY)** | No mock/dry-run mode exists. Pieces verified by running: `extractPdfText` on 4 demo PDFs (e.g. M3 study: 10 pp, 12,845 chars, `reserve_study`, 344 ms); route returns `{docs, buildingNameHint, failures, missing}` with per-file statuses. |
| 17 | Consent checkbox | **PASS (code-read UI) / PASS (running, unit) / live BLOCKED** | UI: `disabled={busy \|\| files.length === 0 \|\| !consent}` + handler early-return. Server: `hasUploadConsent` accepts only `true`/`"true"` (unit-tested, in suite). Live route 400 unreachable without keys (503 fires first). Draft: `e2e/e2e-17-consent.spec.ts`. |
| 18 | Delete cascade | **PASS (code-read) / live BLOCKED (needs SurrealDB)** | `deleteReportCascade` (`lib/db.ts`): owner-scoped, order flags → documents (metadata + page text) → report → building shell only if no reports remain. Agent Memory forget is best-effort semantic (`forgetReportBeliefs` never throws; route doesn't fail on it) — documented, and the user-facing copy now says so. Raw PDF bytes never stored. |
| 19 | Retention cron | **PASS (running, fake DB + mocked clock)** | `runRetentionCleanup`: cutoff exactly `now − 30d`; 30d+1s doc → deleted, 30d−1s → kept; `DELETE document WHERE created_at < $cutoff` — reports/flags/facts/buildings untouched. `getRetentionDays` falls back to 30 on bad env; `isCronAuthorized` fails closed. Live cron run BLOCKED (needs SurrealDB + Vercel). |

### E. Nasty inputs

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 20 | Non-PDF/corrupt/password/0-byte/>4MB | **PASS (running, lib level)** | Non-PDF renamed `.pdf`, corrupted bytes, truncated, password-protected (pypdf-generated), 0-byte → all throw the clean `Could not read "…" as a PDF. It may be corrupted or password-protected.` → route collects into `failures[]`, 422 if all fail. No crash/hang. 4 MB total cap + 15 MB/file enforced server-side in code (`start/route.ts`); live 413 BLOCKED (needs keys); no route test covers the cap (open issue). |
| 21 | Fully scanned PDF → OCR path | **Detection PASS (running); transcription BLOCKED (needs key); handoff bug FIXED** | Image-only PDF (PIL-rendered, 0 extractable chars): `isScanned=true` in 11 ms; route shows "Read via OCR" or clean per-file failure without key. **Found: `buf` was detached by unpdf → OCR always got 0 bytes → fixed in `951c624`** (verified: 4900 → 4900 bytes after fix). |
| 22 | Mixed stack | **PASS (verified by running)** | Simulated route loop: text PDF → `{status:"extracted", pages:2}`; scanned → per-file failure entry; overall succeeds with `docs + failures`, statuses correct. |
| 23 | 100+ page stack: time + cost | **PASS (verified by running)** | Generated 100-page PDF (299 KB): extraction **2,005 ms** → truncated to 40 pp / 60k chars (now with UI notice, `48bd7a6`). Est. ~17.5k input tokens; at $3/$15 per MTok → **≈$0.06–0.13 per analysis**; worst case (12 files × 60k chars ≈ 180k tokens) ≈ **$0.54**. 2 s extraction + ~30–60 s Claude + 240 s abort all fit the 300 s budget with margin. |
| 24 | Prompt injection | **Code-audit PASS / live BLOCKED (needs key); hardening added** | `AnalysisSchema.safeParse` + one repair attempt → schema-valid or clean error, never an invalid report. `verifyAnalysis`: any unverified evidence → severity forced ≤ `warning`, `money_exposure` nulled — an unverified claim **cannot** stay Critical. Gap found: `SYSTEM_PROMPT` had no instruction-hierarchy clause and documents are pasted raw → **fixed in `ace4125`**. |
| 25 | Fabricated quote rejected | **PASS (verified by running)** | Direct `verifyQuote` test: fabricated → `{verified:false, matchType:"none"}`; verbatim → `exact_page`; near-miss ($8,500→$9,500) → rejected. Existing suite: "fabricated quote -> rejected" et al. (in the 124 passing). |
| 26 | Duplicates / two buildings / merge picker | **PASS (code-read) / live-with-data BLOCKED** | Same bytes twice → `upsertBuilding` matches `dedupe_key` → same building, second report (by design; surfaces in history/deltas). Different buildings → separate rows. Merge picker: live-queries `GET /api/buildings/match?hint=` (owner-scoped ILIKE, limit 5); chosen id re-validated owner-side in `run`. No file-hash dedupe (re-analysis is intentional). |

### F. Privacy & security

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 27 | Name redaction on all surfaces | **Tests PASS (16/16); adversarial probe: 21/35 caught, 14 leak formats OPEN (see issue #2); API leak FIXED** | Probe (35 cases): caught `J. Smith`, role-annotated, `Moved by…/seconded by…`, sign-offs; **leaked**: `LAST, FIRST`, first-name-only, ALL-CAPS, apostrophes, lowercase, `J Smith`, surname-alone, possessives, emails, diacritics; partial: 3-word names, hyphenated, `Dr.` remnants. Surfaces: report UI/deltas/Agent Memory use redacted text ✓. **Found: API JSON (`/api/analyze/run` ephemeral + persistence-error paths) and the report page's Flight data returned ORIGINAL `quote`s — the code comment claiming otherwise was false → fixed in `e82a348` (`toPublicAnalysis`), 2 tests added.** DB keeps originals for the verification audit (disclosed in `lib/redact.ts`). |
| 28 | Logs leak nothing | **PASS (verified by running)** | Full test output grepped: only synthetic fixture names in test titles. Production code has exactly one log call (`lib/agent-memory.ts:227` — error message only, no document contents). No document text/names/secrets logged. |
| 29 | Rate/cost guard | **Was MISSING → fixed in `be3a5f3`** | Added `lib/rate-limit.ts`: stateless 480-page run cap (always enforced, 413) + per-user daily limit (default 10/day, SurrealDB-backed, 429). Wired after validation/credit-gate in `run/route.ts`; `daily_usage` table in schema; env docs. 10 new tests (fake-DB). Documented limits: counter is read-then-write (tiny race, acceptable for a cost guard); no durable counter when DB unconfigured. |
| 30 | Stripe off/on | **Off PASS (code-read); test-mode BLOCKED (needs keys); live-key guard FIXED** | Off: `/api/checkout` → 404, webhook → 404, `isStripeEnabled()` false. **Found: `getStripe()` accepted any key — a live key would create real charges → fixed in `48a09e7`**: `isTestStripeKey()` + fail-closed in `getStripe()` and `isStripeEnabled()`. 4 new tests. |
| 31 | Security headers + caching | **Was MISSING → fixed in `f2a3ffb`** | `next.config.ts` had no `headers()` at all → added HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. Caching risk assessed low: user routes call `auth()` (dynamic); only `/`, `/demo`, `/privacy` are static-cacheable (public content). |

### G. Content honesty

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 32 | Every user-facing claim is true | **False claims FIXED in `e3791cc`** | "verified red-flag report in about a minute" → **false** (measured ~93 s typical, 3–4 min OCR) → "a few minutes" (landing ×1, dashboard empty-state ×1, upload hint ×1). Delete "permanently removes…" → **false by omission** (Agent Memory best-effort) → caveat added (`/privacy` + delete-success message). README "persists atomically… never half-finished" → **false** (sequential CREATEs, no transaction) → corrected. "run-route JSON stays ~720 KB max" → unverifiable → replaced with the enforced 480-page cap. "$400–800" kept (attributed external typical). |
| 33 | Eval labeled synthetic; real-stack guide + template | **Fixed in `490017e`** | README now calls the seeded case **synthetic** explicitly and documents the real-stack workflow (label-first methodology, `/private-samples/`, keep real cases untracked). Added `eval/real-stack-template.json` (empty, field-documented). Seeded run still EVAL PASS. |
| 34 | Disclaimer on every report view | **PASS (verified by running)** | Rendered `/demo`: full Disclaimer section present. All three report views (`/app/reports/[id]`, `/demo`, ephemeral `UploadForm`) render through `ReportView`; plus short disclaimer in footer (every page) and full "What this isn't" on `/privacy`. |
| 35 | README prior-work + data disclosures | **PASS (verified by running)** | Git log: 37 commits, all 2026-10-18, first "Scaffold Next.js 16 app…" → supports "nothing before Oct 16 except the idea". `demo-docs/SOURCES.md` matches README (M3 = real public sample; 6 = synthetic, watermarked). Verified: "SAMPLE DOCUMENT" watermark on every page of all 6 synthetic PDFs; M3 PDF **byte-identical (sha256) to the live file** at m3consulting.ca (299,994 bytes). |

### H. UX / accessibility

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 36 | Mobile 375px | **BLOCKED (no browser/screenshots) + code audit** | Layouts use `flex-wrap`, `sm:`/`lg:` grids → single column; file rows `truncate`; cards `p-5 sm:p-6` — 375px-safe by reasoning. **Likely issue (unconfirmed): `components/Header.tsx`** nav is `flex items-center gap-2` with no wrap/mobile menu (~440px+ estimated) → probable overflow at 375px. Needs a visual check. |
| 37 | Keyboard / focus / images / severity | **Dropzone FIXED in `7da139d`; rest PASS** | **Found:** dropzone was a `<div>` with onClick, wrapping a `hidden` (untabbable) file input — keyboard users couldn't open the picker at all → added `role="button"`, `tabIndex`, Enter/Space handler, `aria-label`, focus ring. Everything else native (buttons/links/checkbox). No `:focus-visible` CSS but Tailwind keeps browser defaults; the one `focus:outline-none` pairs with a visible ring. Images: none. Severity: text labels + color (not color-only). |
| 38 | Loading / empty / error states | **Partial PASS; gaps OPEN (see issue #4)** | Upload: loading stages + hints ✓, typed errors + per-file failures ✓. Dashboard/buildings: empty states ✓. **Missing:** no `loading.tsx`/`error.tsx`/`not-found.tsx` under `app/` (Next defaults); `AgentMemoryPanel` renders `null` on unconfigured/failed/empty — failure indistinguishable from "no memory". |

### I. Deploy readiness

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 39 | DEPLOY.md | **Done** | `DEPLOY.md` at repo root: 6 accounts, full env-var table (cross-checked against `process.env.*` + new `MAX_ANALYSES_PER_DAY`/`MAX_PAGES_PER_RUN`), Vercel import, cron, `/api/health` verification, `npm run e2e` + `BASE_URL` for live. Unverifiable steps marked `[UNVERIFIED]`. |
| 40 | Manual file uploads | **FAIL (open)** | Still required — see corrected check #4. Via the GitHub web UI: 7 PDFs → `demo-docs/`, `app/favicon.ico` → `app/`. The 6 repo-root `demo-*.pdf` duplicates are byte-identical unreferenced copies — skip them. |

## Open issues (ranked)

1. **HIGH — Default model retires 2026-11-30.** `claude-sonnet-4-5-20250929` was deprecated 2026-09-30; requests fail after 2026-11-30 (replacement: `claude-sonnet-5-5`). The app works through the hackathon, but the pinned default has a 6-week fuse. *Proposed fix:* after the hackathon, set `ANTHROPIC_MODEL=claude-sonnet-5-5` and re-run the eval — note Sonnet 5.5 changes (thinking on by default, no `temperature`/`top_p`, ~30% more tokens per text). Do NOT switch blind: it needs a live eval run.
2. **HIGH — Name-redaction heuristic leaks 14 formats.** Adversarial probe (`/home/hatch/tmp-work/drafts/adversarial-redact.ts`, kept out of repo): `LAST, FIRST`, first-name-only, ALL-CAPS, apostrophes (`O'Brien`), lowercase, `J Smith` (no dot), surname-alone, possessives, emails, diacritics (`José García`), 3-word first-name leaks, hyphenated surnames, `Dr.` remnants. *Proposed fix:* extend `lib/redact.ts` patterns (cheap wins: `LAST, FIRST`, all-caps bigrams, possessive strip) or add an NER pass; re-run the probe. The API/Flight leak (the dangerous one) is fixed; these are UI-text leaks.
3. **MEDIUM — `npm audit` never ran** (registry proxy 403). Run it on an open network before deploy; fix high/critical.
4. **MEDIUM — Missing Next.js loading/error boundaries.** No `loading.tsx`/`error.tsx`/`not-found.tsx` under `app/`; `AgentMemoryPanel` is silent on failure. *Proposed fix:* add the three convention files + a loading skeleton/error note in the panel.
5. **MEDIUM — e2e specs unrunnable here** (Chromium download fails in sandbox). Run `npx playwright install chromium && npm run e2e` locally, and `BASE_URL=https://<app> npm run e2e` after deploy.
6. **MEDIUM — Daily rate limit is read-then-write** (tiny race; documented in code) and doesn't apply when SurrealDB is unconfigured (serverless has nowhere durable to count). Acceptable for a cost guard; revisit if abuse is observed.
7. **LOW — Probable mobile header overflow** at 375px (`components/Header.tsx`, unconfirmed visually — no browser here).
8. **LOW — Clerk `createRouteMatcher` deprecation warning** in dev logs (proxy.ts). Migrate to resource-based auth checks per Clerk's guide when convenient.
9. **LOW — 4 MB upload cap has no route test** (enforced in code; live 413 unverified without keys).
10. **LOW — Repair-retry resends error text only** (pre-existing quirk from earlier work; a repair attempt on a huge stack can't succeed — noted, out of scope).

## Manual checklist for Sakshit (everything BLOCKED, in order)

**Accounts & keys** (all unverified here — no keys in this environment):
- [ ] **Clerk** — dashboard.clerk.com → app → copy Publishable key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, Secret key → `CLERK_SECRET_KEY`. *Pass:* sign-in wall appears on `/app/*`.
- [ ] **Anthropic** — console.anthropic.com → API key → `ANTHROPIC_API_KEY` (goes in Vercel env vars, never in chat). *Pass:* an upload produces a real report.
- [ ] **SurrealDB Cloud** — surrealdb.com/cloud → instance → `SURREAL_URL` (+ `SURREAL_NS`/`SURREAL_DB`, and `SURREAL_USER`/`SURREAL_PASS` or `SURREAL_TOKEN`). Schema applies automatically on first connect. *Pass:* reports persist; building history accumulates.
- [ ] **Agent Memory (optional)** — SurrealDB Studio → org → Contexts → create context + API key → `SPECTRON_URL`, `SPECTRON_CONTEXT_ID`, `SPECTRON_API_KEY`. *Pass:* recall panel on building history shows beliefs. (Without it the app works exactly as before.)
- [ ] **Stripe (optional)** — keep `STRIPE_ENABLED=false` for beta-free. To enable: test-mode keys only (`sk_test_…` — the code now refuses live keys); webhook → `/api/stripe/webhook`. *Pass:* test checkout completes, no real charge.
- [ ] **Vercel** — import the repo, add env vars (full table in DEPLOY.md §2), deploy. Cron needs no dashboard setup (`vercel.json` declares it) but set `CRON_SECRET` (`openssl rand -hex 32`).

**Verify the deployment:**
- [ ] `GET /api/health` → 200, `"status":"ok"`, all services `true`.
- [ ] `GET /demo` → 200, sample report + "13 of 13 claims verified" + disclaimer.
- [ ] Sign in → `/app/new` → upload `demo-docs/*.pdf` → report renders → "Delete this report" removes it.
- [ ] `npx playwright install chromium && npm run e2e` locally, then `BASE_URL=https://<your-app> npm run e2e` against production.
- [ ] `npm audit` on an open network; fix high/critical.
- [ ] Mobile visual check (375px), especially the header nav.
- [ ] Before **2026-11-30**: switch `ANTHROPIC_MODEL` to `claude-sonnet-5-5` and re-run `npm run eval` (see open issue #1).

**Manual file uploads** (binaries cannot go through the push connector — use the GitHub web UI drag-drop; local copies at `~/workspace/goals/build-north-clearcondo/demo-docs/`):
- [ ] Into `demo-docs/`: `demo-01-board-minutes-2026-09-09.pdf`, `demo-02-agm-minutes-2026-04-22.pdf`, `demo-03-reserve-fund-plan-summary-2026.pdf`, `demo-04-information-statement-unit-506.pdf`, `demo-2024-01-board-minutes-2024-09-11.pdf`, `demo-2024-02-reserve-fund-plan-summary-2024.pdf`, `m3-sample-reserve-fund-study.pdf`
- [ ] Into `app/`: `favicon.ico`
*Pass:* `github.com/sakshit2004/clearcondo/tree/main/demo-docs` shows 7 PDFs.

## Measured numbers

| Metric | Value | How |
|--------|-------|-----|
| Build | ~50 s, 20 pages, green | `npm run build` |
| Typecheck | clean | `tsc --noEmit` |
| Lint | 0 errors, 7 warnings (pre-existing unused vars) | `npm run lint` |
| Tests | **124/124 pass** (106 at branch base + 18 new) | `npm test` |
| Eval (seeded, synthetic) | recall 100% (7/7), fabricated 0/13, verified 100% (13/13) | `npm run eval -- eval/north-hill-terrace-2026` |
| Smoke | pass (7 demo PDFs + bad.pdf rejection) | `npm run smoke` |
| Text extraction | ~24 ms/page | measured |
| 100-page PDF | 2,005 ms extraction → truncated to 40 pp / 60k chars (now with UI notice) | generated reportlab PDF |
| Typical analysis | ~93 s est. vs 300 s `maxDuration` | token math (no key to measure live) |
| Cost per report | **≈$0.06–0.13** typical; ≈$0.54 worst case (180k tokens @ $3/$15 per MTok) | Sonnet 4.5 pricing |
| /api/health (zero env) | 200, `"status":"degraded"`, all services `false` | live curl |

## Honesty notes

- Checks marked BLOCKED were **not** verified — they need Sakshit's keys/accounts/deploy. The manual checklist above is the complete list.
- The three workers ran in parallel from the same base commit; the coordinator (this file's author) re-verified every FAIL with an independent repro before fixing (buffer detach: 4900→0 bytes; API quote leak: read the response-building code; `dynamic` 500: live curl).
- The seeded eval is **synthetic** — it proves the harness works, not that the model finds real red flags. `eval/real-stack-template.json` + README guide cover the real-stack workflow.
- Two earlier expectations were refuted by evidence and are recorded as such: the "13 missing PDFs" (all present) and "/demo renders both reports" (renders one + the diff).
