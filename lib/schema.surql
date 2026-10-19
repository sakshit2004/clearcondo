-- ClearCondo SurrealDB schema.
--
-- TWO-LAYER MEMORY ARCHITECTURE (see README "Architecture"):
--   1. These tables are the deterministic application store. Every number the
--      UI shows comes from here: buildings deduped per user, documents,
--      reports with facts_snapshot, flags with provenance (source document +
--      verbatim quote). Deltas ("what changed since the last review") are
--      computed from consecutive facts_snapshots — fully deterministic and
--      unit-tested (lib/deltas.ts).
--   2. SurrealDB Agent Memory (lib/agent-memory.ts, env-gated via SPECTRON_*)
--      is the belief layer: each completed analysis is remembered as factual
--      text, the service extracts entities/attributes itself, reconciles them
--      against prior beliefs, and end-dates superseded facts instead of
--      overwriting them. The building page recalls those beliefs with hybrid
--      retrieval. Plain tables alone would NOT qualify for "Best Use of
--      SurrealDB Agent Memory" — the product is a distinct hosted layer
--      (remember/extract/reconcile/store/recall), and this schema documents
--      how we use it.
--
-- The memory story: every analysis persists into four linked tables.
--   building  - one row per condo corporation per user (deduped)
--   document  - each uploaded PDF, linked to its building
--   report    - each analysis run, linked to its building
--   flag      - each red flag, linked to its report AND its building,
--               with provenance (source document name + verbatim quote)
--   credit    - Stripe report-credit balance per user (test mode)
--
-- Repeat uploads for the same building accumulate: the building page shows
-- every report and every flag ever raised, with first-seen dates — the
-- building's memory grows with each analysis.

DEFINE TABLE IF NOT EXISTS building SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON TABLE building TYPE string;
DEFINE FIELD IF NOT EXISTS corp_number ON TABLE building TYPE option<string>;
DEFINE FIELD IF NOT EXISTS address ON TABLE building TYPE option<string>;
DEFINE FIELD IF NOT EXISTS units ON TABLE building TYPE option<int>;
DEFINE FIELD IF NOT EXISTS year_built ON TABLE building TYPE option<int>;
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE building TYPE string;
DEFINE FIELD IF NOT EXISTS dedupe_key ON TABLE building TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE building TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE building TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS building_dedupe ON TABLE building COLUMNS dedupe_key UNIQUE;

DEFINE TABLE IF NOT EXISTS document SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS building ON TABLE document TYPE record<building>;
-- Which analysis run produced this document. Lets "delete this report" remove
-- exactly its own documents, and lets retention explain what each row was for.
DEFINE FIELD IF NOT EXISTS report ON TABLE document TYPE option<record<report>> DEFAULT NONE;
DEFINE FIELD IF NOT EXISTS filename ON TABLE document TYPE string;
DEFINE FIELD IF NOT EXISTS doc_type ON TABLE document TYPE string;
DEFINE FIELD IF NOT EXISTS page_count ON TABLE document TYPE int;
DEFINE FIELD IF NOT EXISTS char_count ON TABLE document TYPE int;
DEFINE FIELD IF NOT EXISTS status ON TABLE document TYPE string DEFAULT "extracted";
-- Extracted page text, [{ page_number, text }]. Raw PDF bytes are never stored;
-- this is the most sensitive bulk data we keep, and the retention cron deletes
-- the whole document row (metadata + text) after RETENTION_DAYS.
DEFINE FIELD IF NOT EXISTS pages ON TABLE document TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE document TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE document TYPE datetime DEFAULT time::now();

DEFINE TABLE IF NOT EXISTS report SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS building ON TABLE report TYPE record<building>;
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE report TYPE string;
DEFINE FIELD IF NOT EXISTS status ON TABLE report TYPE string DEFAULT "complete";
DEFINE FIELD IF NOT EXISTS summary ON TABLE report TYPE string;
DEFINE FIELD IF NOT EXISTS money_exposure_total_cad ON TABLE report TYPE option<number>;
DEFINE FIELD IF NOT EXISTS money_exposure_basis ON TABLE report TYPE string;
DEFINE FIELD IF NOT EXISTS questions ON TABLE report TYPE array<string>;
DEFINE FIELD IF NOT EXISTS model ON TABLE report TYPE string;
DEFINE FIELD IF NOT EXISTS facts ON TABLE report TYPE object;
DEFINE FIELD IF NOT EXISTS verified_claims ON TABLE report TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_claims ON TABLE report TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS facts_snapshot ON TABLE report TYPE option<object> DEFAULT NONE;
DEFINE FIELD IF NOT EXISTS doc_date ON TABLE report TYPE option<string> DEFAULT NONE;
DEFINE FIELD IF NOT EXISTS missing_documents ON TABLE report TYPE option<array<object>> DEFAULT NONE;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE report TYPE datetime DEFAULT time::now();

DEFINE TABLE IF NOT EXISTS flag SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS report ON TABLE flag TYPE record<report>;
DEFINE FIELD IF NOT EXISTS building ON TABLE flag TYPE record<building>;
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE flag TYPE string;
DEFINE FIELD IF NOT EXISTS flag_type ON TABLE flag TYPE string;
DEFINE FIELD IF NOT EXISTS severity ON TABLE flag TYPE string;
DEFINE FIELD IF NOT EXISTS title ON TABLE flag TYPE string;
DEFINE FIELD IF NOT EXISTS explanation ON TABLE flag TYPE string;
DEFINE FIELD IF NOT EXISTS evidence ON TABLE flag TYPE array<object>;
DEFINE FIELD IF NOT EXISTS money_exposure ON TABLE flag TYPE option<object>;
DEFINE FIELD IF NOT EXISTS downgraded ON TABLE flag TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE flag TYPE datetime DEFAULT time::now();

DEFINE TABLE IF NOT EXISTS credit SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE credit TYPE string;
DEFINE FIELD IF NOT EXISTS balance ON TABLE credit TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE credit TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS credit_owner ON TABLE credit COLUMNS owner_id UNIQUE;

-- Per-user daily analysis counters (cost guard, lib/rate-limit.ts).
DEFINE TABLE IF NOT EXISTS daily_usage SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS owner_id ON TABLE daily_usage TYPE string;
DEFINE FIELD IF NOT EXISTS day ON TABLE daily_usage TYPE string;
DEFINE FIELD IF NOT EXISTS count ON TABLE daily_usage TYPE int DEFAULT 0;
DEFINE INDEX IF NOT EXISTS daily_usage_owner_day ON TABLE daily_usage COLUMNS owner_id, day UNIQUE;
