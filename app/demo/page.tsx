import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import ReportView from "@/components/ReportView";

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
  const meta = [
    b.corp_number ? `Corp No. ${b.corp_number}` : null,
    b.address,
    b.units ? `${b.units} units` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="rounded-xl border border-teal-800/30 bg-teal-50 px-5 py-4 text-sm text-teal-900 mb-8">
        <span className="font-semibold">Sample data.</span> Two fictional
        reviews of the same demo building — September 2024 and October 2026 —
        showing how building memory tracks change over time. Upload your own
        documents to analyze a real building.
      </div>
      <ReportView
        report={{
          buildingName: b.name || "Sample building",
          buildingMeta: meta,
          isSample: true,
          analysis: newer,
          deltas,
        }}
      />
      <div className="mt-10 text-center">
        <Link
          href="/app/new"
          className="inline-block bg-teal-800 hover:bg-teal-900 text-white px-8 py-3.5 rounded-lg font-semibold text-lg"
        >
          Analyze your own documents
        </Link>
      </div>
    </div>
  );
}
