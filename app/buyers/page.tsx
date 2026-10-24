import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import { pointFromFacts } from "@/lib/timeline";
import EvidenceDemo from "@/components/EvidenceDemo";
import MemoryRecord, { recordRows } from "@/components/MemoryRecord";
import Reveal from "@/components/Reveal";
import { AudienceHero, SectionHead } from "@/components/landing/parts";

export const metadata: Metadata = {
  title: "For condo buyers — ClearCondo",
  description:
    "Know the real price of a condo before your conditions come off: special assessments, reserve shortfalls and lawsuits from the document package, priced per unit and traced to the page.",
};

const STEPS: [string, string][] = [
  ["Add the documents", "Upload the PDFs from the seller or property manager: minutes, reserve fund study, bylaws, financials."],
  ["We read every page", "Special assessments, reserve health, litigation and insurance, each claim checked against the page it cites."],
  ["Get the real price", "Every red flag priced per unit, online or as a PDF for your lawyer, before your conditions come off."],
];

/** The sample building's record across its two reviews (sample data). */
function getSampleRecord() {
  const load = (f: string) =>
    VerifiedAnalysisSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "sample-data", f), "utf8")));
  const older = load("sample-report-2024.json");
  const newer = load("sample-report-2026.json");
  const [from, to] = [older, newer].map((r, i) =>
    pointFromFacts({
      facts: r.structured_facts,
      docDate: r.structured_facts.doc_date,
      exposureCad: r.money_exposure_total_cad,
      fallbackLabel: i === 0 ? "Earlier" : "Latest",
      fallbackSortKey: String(i),
    })
  );
  const b = newer.building;
  return {
    buildingName: b.name || "Sample building",
    buildingMeta: b.corp_number ? `Corp No. ${b.corp_number}` : "",
    fromLabel: from.label,
    toLabel: to.label,
    rows: recordRows([from.fundedPct, to.fundedPct], computeDeltas(older.structured_facts, newer.structured_facts)),
  };
}

/** Everything for buyers, on one page. The buyer dashboard is /app. */
export default function BuyersPage() {
  const record = getSampleRecord();
  return (
    <div>
      <AudienceHero
        audience="buyers"
        title="Know the real price before your conditions come off."
        body="Upload the condo's document package. ClearCondo reads every page and prices what's buried in it: special assessments, thin reserves, lawsuits, every claim traced to its page."
        cta={{ href: "/app", label: "Open the buyer dashboard" }}
        sample={{ href: "/demo", label: "See a sample report" }}
        note="Free during beta."
      />

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <ol className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map(([title, body], i) => (
              <Reveal key={title} delay={i * 100}>
                <li className="border-t border-ink pt-5 list-none">
                  <span className="data-label text-subtle">0{i + 1}</span>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.01em]">{title}</h2>
                  <p className="mt-1.5 text-muted">{body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-surface border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead
            title="Every red flag, traced to the page."
            body="Every claim is matched to the sentence it came from. If we can't find it, the flag is downgraded and loses its dollar figure."
          />
          <EvidenceDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <SectionHead
          title="The building remembers."
          body="Every building keeps one record of what it really costs. Each new package is checked against what we already verified, and facts that changed are dated, not overwritten."
        />
        <MemoryRecord {...record} />
        <Reveal className="mt-5">
          <p className="text-sm text-subtle max-w-2xl">
            Only verified facts are written to a building&apos;s record, so it can&apos;t drift on a guess. Sample data
            shown.
          </p>
        </Reveal>
      </section>

    </div>
  );
}
