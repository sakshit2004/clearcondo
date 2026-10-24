import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema, type VerifiedAnalysis } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import { pointFromFacts } from "@/lib/timeline";
import ReportPrint from "@/components/ReportPrint";

function loadReport(file: string): VerifiedAnalysis {
  const json = JSON.parse(
    readFileSync(join(process.cwd(), "sample-data", file), "utf8")
  );
  return VerifiedAnalysisSchema.parse(json);
}

/**
 * The service deliverable: the PDF version of the sample report — what
 * goes back to the realtor's inbox, with their name on the first page.
 * ?for= and ?brokerage= personalize it; ?download=1 opens the print
 * dialog on arrival.
 */
export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string; brokerage?: string; download?: string }>;
}) {
  const sp = await searchParams;
  const preparedFor = (sp.for || "A ClearCondo client").slice(0, 120);
  const brokerage = (sp.brokerage || "").slice(0, 120);

  const older = loadReport("sample-report-2024.json");
  const newer = loadReport("sample-report-2026.json");
  const deltas = computeDeltas(older.structured_facts, newer.structured_facts);
  const b = newer.building;
  const timeline = [older, newer].map((r, i) =>
    pointFromFacts({
      facts: r.structured_facts,
      docDate: r.structured_facts.doc_date,
      exposureCad: r.money_exposure_total_cad,
      fallbackLabel: i === 0 ? "Earlier review" : "Latest review",
      fallbackSortKey: String(i),
    })
  );
  const meta = [
    b.corp_number ? `Corp No. ${b.corp_number}` : null,
    b.address,
    b.units ? `${b.units} units` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ReportPrint
      analysis={newer}
      buildingName={b.name || "Condominium"}
      buildingMeta={meta}
      preparedFor={preparedFor}
      brokerage={brokerage || undefined}
      timeline={timeline}
      deltas={deltas}
      isSample
      backHref="/demo"
      backLabel="Back to the interactive report"
      autoPrint={sp.download === "1"}
    />
  );
}
