import { notFound, redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, getReport, getPreviousFactsSnapshot, isDbConfigured } from "@/lib/db";
import { computeDeltas, type Delta } from "@/lib/deltas";
import { toPublicAnalysis } from "@/lib/redact";
import SetupNotice from "@/components/SetupNotice";
import DeleteReportButton from "@/components/DeleteReportButton";
import ReportView, { type ReportVM } from "@/components/ReportView";
import type { VerifiedAnalysis, VerifiedStructuredFacts } from "@/lib/report-schema";


export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  if (!isDbConfigured()) return notFound();

  const { id } = await params;
  const fullId = `report:${decodeURIComponent(id)}`;

  const data = await withDb((db) => getReport(db, userId, fullId));
  if (!data) return notFound();

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

  const vm: ReportVM = {
    buildingName: report.building_name || facts.name || "Unnamed building",
    buildingMeta: meta || undefined,
    createdAt: String(report.created_at),
    // Strip original evidence quotes: the browser only ever sees redacted text.
    analysis: toPublicAnalysis(analysis),
    deltas,
    missing: report.missing_documents ?? [],
  };

  return (
    <div className="max-w-4xl">
      <ReportView report={vm} />
      <div className="mt-10 pt-6 border-t border-stone-200">
        <DeleteReportButton reportId={id} />
      </div>
    </div>
  );
}
