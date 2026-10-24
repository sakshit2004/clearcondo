import { withDb, getReport, getPreviousFactsSnapshot } from "@/lib/db";
import { computeDeltas, type Delta } from "@/lib/deltas";
import { toPublicAnalysis } from "@/lib/redact";
import { pointFromFacts, type TimelinePoint } from "@/lib/timeline";
import type { ReportVM } from "@/components/ReportView";
import type { VerifiedAnalysis, VerifiedStructuredFacts } from "@/lib/report-schema";

/**
 * Load one of the user's reports as a ReportVM — shared by the
 * interactive report page and its print/PDF view. Returns null when the
 * report doesn't exist or isn't theirs.
 */
export async function loadReportVM(userId: string, id: string): Promise<ReportVM | null> {
  const fullId = `report:${decodeURIComponent(id)}`;

  const data = await withDb((db) => getReport(db, userId, fullId));
  if (!data) return null;

  const { report, flags } = data;

  const emptySnapshot: VerifiedStructuredFacts = {
    doc_date: report.doc_date,
    reserve_balance_cad: null,
    reserve_recommended_cad: null,
    contribution_monthly_cad: null,
    insurance_deductible_cad: null,
    special_assessments: [],
    litigation: [],
    rental_rules: null,
    rental_rules_evidence: null,
    fee_change_pct: null,
  };
  const snapshot: VerifiedStructuredFacts = {
    ...emptySnapshot,
    ...(report.facts_snapshot ?? {}),
  };

  // "What changed since the last review" — diff against the previous snapshot.
  const prev = await withDb((db) =>
    getPreviousFactsSnapshot(db, userId, String(report.building), fullId)
  );
  const deltas: Delta[] = prev ? computeDeltas(prev.snapshot, snapshot) : [];

  const analysis: VerifiedAnalysis = {
    building: report.facts,
    structured_facts: snapshot,
    flags: flags.map((f) => ({
      flag_type: f.flag_type as VerifiedAnalysis["flags"][number]["flag_type"],
      severity: f.severity as VerifiedAnalysis["flags"][number]["severity"],
      title: f.title,
      explanation: f.explanation,
      evidence: f.evidence,
      money_exposure: f.money_exposure,
      downgraded: f.downgraded ?? false,
    })),
    money_exposure_total_cad: report.money_exposure_total_cad,
    money_exposure_basis: report.money_exposure_basis,
    questions_for_realtor_lawyer: report.questions,
    summary: report.summary,
    verification: {
      verified_claims: report.verified_claims ?? 0,
      total_claims: report.total_claims ?? 0,
    },
  };

  const facts = report.facts;
  const meta = [
    facts.corp_number ? `Corp No. ${facts.corp_number}` : null,
    facts.address,
    facts.units ? `${facts.units} units` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Risk timeline — previous review vs this one, when a previous exists.
  // (The previous report's exposure total isn't loaded here, so that point
  // carries reserve/deductible only; the component omits what's missing.)
  const timeline: TimelinePoint[] | undefined = prev
    ? [
        pointFromFacts({
          facts: prev.snapshot,
          docDate: prev.docDate,
          exposureCad: null,
          fallbackLabel: "Previous review",
          fallbackSortKey: "0",
        }),
        pointFromFacts({
          facts: snapshot,
          docDate: snapshot.doc_date,
          exposureCad: report.money_exposure_total_cad,
          fallbackLabel: "This review",
          fallbackSortKey: "1",
        }),
      ]
    : undefined;

  return {
    buildingName: report.building_name || facts.name || "Unnamed building",
    buildingMeta: meta || undefined,
    createdAt: String(report.created_at),
    // Strip original evidence quotes: the browser only ever sees redacted text.
    analysis: toPublicAnalysis(analysis),
    deltas,
    timeline,
    missing: report.missing_documents ?? [],
  };
}
