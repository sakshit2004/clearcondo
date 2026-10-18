import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import {
  analyzeDocuments,
  isAnthropicConfigured,
} from "@/lib/analyze";
import {
  withDb,
  dbQuery,
  upsertBuilding,
  createDocument,
  persistAnalysis,
  getPriorFlags,
  getPreviousFactsSnapshot,
  isDbConfigured,
  isStripeEnabled,
  getCreditBalance,
  spendCredit,
} from "@/lib/db";
import { computeDeltas, type Delta } from "@/lib/deltas";
import {
  docTextWithPageMarkers,
  type PageText,
} from "@/lib/extract";
import { verifyAnalysis, type VerifiableDoc } from "@/lib/verify";
import { rememberBuildingFacts } from "@/lib/agent-memory";
import type { DocType } from "@/lib/report-schema";

export const maxDuration = 120;

interface RunDoc {
  fileId: string;
  filename: string;
  docType: string;
  pages: PageText[];
  pageCount: number;
  charCount: number;
  status: "extracted" | "ocr" | "failed";
  isScanned: boolean;
}

/**
 * Step 2 of the analysis pipeline: run Claude over extracted text, VERIFY
 * every cited quote against the stored page text, persist to SurrealDB
 * (when configured), and return the report.
 */
export async function POST(req: Request) {
  if (!isClerkConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 }
    );
  }
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      {
        code: "no_api_key",
        error:
          "ANTHROPIC_API_KEY is not set on this deployment. Add it to enable AI analysis.",
      },
      { status: 503 }
    );
  }

  let body: { docs?: RunDoc[]; buildingNameHint?: string | null; buildingId?: string | null; missing?: { id: string; label: string; askFor: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // buildingId is the short id (after "building:"); re-qualify it.
  const chosenBuildingId = body.buildingId
    ? `building:${body.buildingId}`
    : null;
  const missing = (body.missing ?? []).filter((m) => m?.label);
  const docs = (body.docs ?? []).filter(
    (d) => d?.pages && d.pages.some((p) => p.text && p.text.length > 0)
  );
  const buildingNameHint = body.buildingNameHint?.trim() || null;
  if (docs.length === 0) {
    return NextResponse.json(
      { error: "No document text to analyze." },
      { status: 400 }
    );
  }

  const stripeOn = isStripeEnabled();
  const dbOn = isDbConfigured();

  // Payment gate (test mode): needs a credit before we spend API budget.
  if (stripeOn && dbOn) {
    const balance = await withDb((db) => getCreditBalance(db, userId));
    if ((balance ?? 0) < 1) {
      return NextResponse.json(
        {
          code: "payment_required",
          error:
            "You're out of report credits. Buy one to run this analysis (test mode — no real charge).",
          checkoutUrl: "/api/checkout",
        },
        { status: 402 }
      );
    }
  }

  // Building memory: pull prior flags for continuity.
  // Priority: the building the user explicitly confirmed on upload,
  // otherwise a name-hint match.
  let memoryContext: string | null = null;
  let matchedBuildingId: string | null = null;
  if (dbOn) {
    const mem = await withDb(async (db) => {
      let bid: string | null = null;
      if (chosenBuildingId) {
        const rows = await dbQuery<{ id: unknown }[]>(
          db,
          "SELECT id FROM building WHERE id = type::thing($id) AND owner_id = $owner LIMIT 1",
          { id: chosenBuildingId, owner: userId }
        );
        if (rows.length > 0) bid = String(rows[0].id);
      }
      if (!bid && buildingNameHint) {
        const rows = await dbQuery<{ id: unknown }[]>(
          db,
          `SELECT id FROM building WHERE owner_id = $owner
           AND (name ILIKE $like OR dedupe_key ILIKE $like) LIMIT 1`,
          { owner: userId, like: `%${buildingNameHint}%` }
        );
        if (rows.length > 0) bid = String(rows[0].id);
      }
      if (!bid) return null;
      const prior = await getPriorFlags(db, userId, bid, 12);
      return { bid, prior };
    });
    if (mem && mem.prior.length > 0) {
      matchedBuildingId = mem.bid;
      memoryContext = mem.prior
        .map((f) => `- [${f.severity}] ${f.title}: ${f.explanation}`)
        .join("\n");
    } else if (mem) {
      matchedBuildingId = mem.bid;
    }
  }

  let result;
  try {
    result = await analyzeDocuments({
      buildingNameHint,
      docs: docs.map((d) => ({
        fileId: d.fileId,
        filename: d.filename,
        docType: d.docType,
        text: docTextWithPageMarkers({
          fileId: d.fileId,
          filename: d.filename,
          pages: d.pages,
          pageCount: d.pageCount,
          charCount: d.charCount,
          status: d.status,
          isScanned: d.isScanned,
        }),
      })),
      memoryContext,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Analysis failed. Please try again.",
      },
      { status: 502 }
    );
  }

  // Verify every cited quote against the stored page text. This is the
  // differentiation: unverified claims are downgraded and lose money figures.
  const verifiableDocs: VerifiableDoc[] = docs.map((d) => ({
    fileId: d.fileId,
    fileName: d.filename,
    pages: d.pages,
    ocr: d.status === "ocr",
  }));
  const verified = verifyAnalysis(result.analysis, verifiableDocs);

  // Persist (when the database is configured).
  if (dbOn) {
    try {
      const out = await withDb(async (db) => {
        const buildingId =
          matchedBuildingId ??
          (await upsertBuilding(db, userId, verified.building, buildingNameHint));
        // Deltas vs the previous review — computed BEFORE persisting so the
        // new report is not compared against itself.
        const prev = await getPreviousFactsSnapshot(db, userId, buildingId);
        const deltas: Delta[] = prev
          ? computeDeltas(prev.snapshot, verified.structured_facts)
          : [];
        for (const d of docs) {
          await createDocument(db, userId, buildingId, {
            filename: d.filename,
            docType: d.docType as DocType,
            pageCount: d.pageCount,
            charCount: d.charCount,
            status: d.status,
          });
        }
        const rid = await persistAnalysis(
          db,
          userId,
          buildingId,
          verified,
          result.model,
          missing
        );
        if (stripeOn) await spendCredit(db, userId);
        // Dual-write to SurrealDB Agent Memory: the verified facts are
        // remembered as beliefs the service extracts, reconciles, and
        // end-dates over time. Best-effort — never fails the request.
        await rememberBuildingFacts({
          ownerId: userId,
          buildingRecordId: buildingId,
          building: verified.building,
          facts: verified.structured_facts,
        });
        return { reportId: rid, deltas };
      });
      if (!out) throw new Error("Database connection failed.");
      return NextResponse.json({ reportId: out.reportId, deltas: out.deltas });
    } catch (err) {
      // Persistence failed but analysis succeeded: return it ephemerally
      // rather than failing the whole request.
      return NextResponse.json({
        analysis: verified,
        buildingName: verified.building.name || buildingNameHint,
        missing,
        persistenceError:
          err instanceof Error ? err.message : "Could not save to database.",
      });
    }
  }

  // No database: ephemeral report.
  return NextResponse.json({
    analysis: verified,
    buildingName: verified.building.name || buildingNameHint,
    missing,
  });
}
