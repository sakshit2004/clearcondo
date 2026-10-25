import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import ReportView, { ReportToolbar } from "@/components/ReportView";
import { pointFromFacts } from "@/lib/timeline";
import BuyerPricing from "@/components/BuyerPricing";
import PublicRecordsSection from "@/components/PublicRecordsSection";
import { SharedRecordSection } from "@/components/SharedRecord";
import { sampleMissingDocs, samplePublicRecordCheck, sampleSharedRecord } from "@/lib/sample-extras";

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
 * It also shows every other section a real report has: the shared building
 * record, the City of Calgary check and the missing-documents list.
 * All documents, reports and records are clearly-labeled sample data.
 */
export default function DemoPage() {
  const older = loadReport("sample-report-2024.json");
  const newer = loadReport("sample-report-2026.json");
  const deltas = computeDeltas(older.structured_facts, newer.structured_facts);
  const shared = sampleSharedRecord(older, newer);

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
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="rise-in rounded-[14px] border border-line bg-white px-5 py-4 text-sm mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-md bg-accent-soft text-accent-dark text-xs font-semibold px-2 py-1">
            Sample data
          </span>
          <span className="text-muted">
            Two fictional reviews of the same demo building, September 2024
            and October 2026: every flag priced and traced to its page, what
            changed since the last review, the shared building record, and
            the City&apos;s records. Open any flag to see the quote it came from.
          </span>
        </div>
        <ReportToolbar backHref="/" backLabel="Home" pdfHref="/demo/print?download=1" />
        <ReportView
          report={{
            buildingName: b.name || "Sample building",
            buildingMeta: meta,
            isSample: true,
            analysis: newer,
            deltas,
            timeline,
            missing: sampleMissingDocs(newer),
          }}
          pdfHref="/demo/print?download=1"
          storageKey="demo"
          buildingRecord={<SharedRecordSection items={shared.items} rows={shared.rows} />}
          publicRecords={<PublicRecordsSection check={samplePublicRecordCheck(newer)} />}
        />
        <div className="mt-12">
          <BuyerPricing />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/order"
            className="btn-lift inline-flex items-center rounded-[10px] bg-accent hover:bg-accent-dark text-white font-semibold px-7 min-h-12"
          >
            Send us your documents
          </Link>
          <Link
            href="/app/new"
            className="inline-flex items-center rounded-[10px] border border-line2 bg-white hover:border-ink font-semibold px-7 min-h-12 transition-colors"
          >
            Analyze documents yourself
          </Link>
        </div>
      </div>
    </div>
  );
}
