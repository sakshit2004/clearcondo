import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import ReportView from "@/components/ReportView";
import { pointFromFacts } from "@/lib/timeline";

function loadReport(file: string) {
  const json = JSON.parse(
    readFileSync(join(process.cwd(), "sample-data", file), "utf8")
  );
  return VerifiedAnalysisSchema.parse(json);
}

/**
 * Sample demo: TWO reports for the same fictional building ("North Hill
 * Terrace") — an older 2024 review and a newer 2026 review — so the
 * "what changed since the last review" memory diff renders with zero API keys.
 * All documents and both reports are clearly-labeled sample data.
 */
export default function DemoPage() {
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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="border border-stone-300 border-l-2 border-l-signal bg-white px-5 py-4 text-sm mb-8 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="micro-label bg-signal text-white px-2 py-1">
          Sample data
        </span>
        <span className="text-stone-600">
          Two fictional reviews of the same demo building — September 2024 and
          October 2026 — showing how building memory tracks change over time.
          Upload your own documents to analyze a real building.
        </span>
      </div>
      <ReportView
        report={{
          buildingName: b.name || "Sample building",
          buildingMeta: meta,
          isSample: true,
          analysis: newer,
          deltas,
          timeline,
        }}
      />
      <div className="mt-10 text-center">
        <Link
          href="/app/new"
          className="inline-block bg-ink text-white hover:bg-signal px-8 py-4 font-semibold text-lg transition-colors"
        >
          Analyze your own documents
        </Link>
        <div className="mt-4">
          <Link
            href="/demo/print"
            className="micro-label text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
          >
            See the client-ready print view — the report as delivered →
          </Link>
        </div>
      </div>
    </div>
  );
}
