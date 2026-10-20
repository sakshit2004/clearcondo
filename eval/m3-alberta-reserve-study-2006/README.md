# Eval case: m3-alberta-reserve-study-2006

The first **real-stack** eval case: M3 Consulting's public Alberta
reserve-fund-study sample (`m3-sample-reserve-fund-study.pdf` — "My
Condominium", Plan 012 3456, 36 units, built 2001, study dated Aug 8, 2006).
The document's format and financials are genuine reserve-study content; the
building identity is M3's anonymized sample, not a real client building.

## Why this case matters

The seeded case (`north-hill-terrace-2026`) is hand-crafted demo data. This
one tests the pipeline against a different, real-world document style —
table-heavy, 2006 vintage, dollar signs trailing the numbers (`6,500$`) —
and against a **healthy** building (109% funded, $1,393 surplus). A correct
analysis must surface the three underfunded components (plumbing, HVAC, fire
protection) **without** crying wolf about overall underfunding.

## The 7 expected flags

| id | severity | what it captures |
|---|---|---|
| plumbing-underfunded-near-term | warning | $6,500 plumbing replacement due 2010; only $1,510 of $3,250 required saved (shortfall $1,740) |
| hvac-underfunded | warning | $12,500 HVAC due 2021; $929 of $5,000 required (shortfall $4,071) |
| fire-protection-shortfall | info | $1,500 fire protection due 2026; $111 of $300 (shortfall $189) |
| reserve-fund-healthy-109pct | info | overall 109% funded — anti-hallucination check |
| window-replacement-2025-largest | info | largest single cost ($28,728, due 2025), well funded ($1,232 surplus) |
| annual-contribution-9419 | info | $9,419.18/yr ($784.93/mo) replacement contribution |
| next-reserve-study-2011 | info | next reserve fund study due 2011 ($2,450) |

All canonical quotes were hand-copied from the repo's own PDF extraction and
validated: `npm run eval` reports **label-ok: yes for all 7**.

## Scoring a real analysis

`analysis` currently points at `analysis-pending.json` (empty stub), so the
run FAILs on recall until a produced analysis exists. To score:

1. Run the ClearCondo pipeline on the M3 PDF (needs a Claude key) and save
   the produced flags JSON.
2. `npm run eval -- eval/m3-alberta-reserve-study-2006 --analysis <path-to-analysis.json>`

Source PDF lives at `../../demo-docs/m3-sample-reserve-fund-study.pdf`
(the repo's own `demo-docs/`, alongside the other demo documents — same
relative layout as the seeded case).
