import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema, type VerifiedAnalysis } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import { buildAuditRows, auditSummary, MATCH_LABELS } from "@/lib/audit";
import { pointFromFacts } from "@/lib/timeline";
import { cad } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

function loadReport(file: string): VerifiedAnalysis {
  const json = JSON.parse(
    readFileSync(join(process.cwd(), "sample-data", file), "utf8")
  );
  return VerifiedAnalysisSchema.parse(json);
}

/**
 * The service deliverable: a client-ready, print-optimized rendering of a
 * report. This is what goes back to the realtor's inbox — their name on
 * the cover, plain language inside, the audit trail at the back. Rendered
 * here from the sample reports so anyone can see the deliverable with
 * zero setup; ?for= and ?brokerage= personalize the cover.
 */
export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string; brokerage?: string }>;
}) {
  const sp = await searchParams;
  const preparedFor = (sp.for || "A ClearCondo client").slice(0, 120);
  const brokerage = (sp.brokerage || "").slice(0, 120);

  const older = loadReport("sample-report-2024.json");
  const newer = loadReport("sample-report-2026.json");
  const deltas = computeDeltas(older.structured_facts, newer.structured_facts);
  const auditRows = buildAuditRows(newer);
  const audit = auditSummary(auditRows);
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
  const latest = timeline[timeline.length - 1];

  const meta = [
    b.corp_number ? `Corp No. ${b.corp_number}` : null,
    b.address,
    b.units ? `${b.units} units` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 print:py-0 print:max-w-none">
      {/* Screen-only toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 print:hidden">
        <p className="text-sm text-stone-500 max-w-md leading-relaxed">
          This is the finished report as the client receives it. Add{" "}
          <span className="font-mono text-[13px]">?for=Name&amp;brokerage=Firm</span>{" "}
          to the address to put a realtor on the cover.
        </p>
        <PrintButton />
      </div>

      {/* Cover */}
      <div className="border-t-2 border-ink pt-6">
        <div className="flex items-baseline gap-2.5 mb-10">
          <span className="w-2.5 h-2.5 bg-signal inline-block" aria-hidden />
          <span className="font-bold text-[17px] tracking-tight text-ink">
            ClearCondo
          </span>
          <span className="micro-label text-stone-500 ml-2">
            Verified red-flag report — sample data
          </span>
        </div>
        <div className="micro-label text-stone-500">Prepared for</div>
        <div className="font-bold text-2xl tracking-tight text-ink mt-1">
          {preparedFor}
          {brokerage ? (
            <span className="text-stone-500 font-semibold"> · {brokerage}</span>
          ) : null}
        </div>
        <h1 className="font-bold tracking-[-0.02em] leading-[1.05] text-4xl text-ink mt-8">
          {b.name || "Condominium"}
        </h1>
        {meta && <p className="text-stone-600 mt-2">{meta}</p>}
        <p className="text-stone-600 leading-relaxed mt-6 max-w-3xl">
          {newer.summary}
        </p>
      </div>

      {/* Key figures */}
      <table className="w-full text-sm mt-10">
        <thead>
          <tr className="border-t-2 border-ink text-left">
            <th className="micro-label py-2.5 pr-4 font-semibold">Figure</th>
            <th className="micro-label py-2.5 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody className="text-stone-600">
          <tr className="border-t border-stone-200">
            <td className="py-2.5 pr-4">Estimated buyer exposure</td>
            <td className="py-2.5 font-bold text-signal tabular-nums text-base">
              {newer.money_exposure_total_cad != null
                ? cad(newer.money_exposure_total_cad)
                : "—"}
            </td>
          </tr>
          <tr className="border-t border-stone-200">
            <td className="py-2.5 pr-4">Claims verified against source pages</td>
            <td className="py-2.5 tabular-nums">
              {newer.verification.verified_claims} of {newer.verification.total_claims}
            </td>
          </tr>
          <tr className="border-t border-stone-200">
            <td className="py-2.5 pr-4">Reserve fund funded</td>
            <td className="py-2.5 tabular-nums">
              {latest.fundedPct != null
                ? `${Math.round(latest.fundedPct)}% of the study recommendation`
                : "Not stated"}
            </td>
          </tr>
          <tr className="border-t border-b border-stone-200">
            <td className="py-2.5 pr-4">Insurance deductible (building)</td>
            <td className="py-2.5 tabular-nums">
              {latest.deductibleCad != null ? cad(latest.deductibleCad) : "Not stated"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Risk over time */}
      <h2 className="font-bold text-xl tracking-tight text-ink mt-12 mb-4">
        Risk over time
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t-2 border-ink text-left">
            <th className="micro-label py-2.5 pr-4 font-semibold">Review</th>
            <th className="micro-label py-2.5 pr-4 font-semibold">Reserve funded</th>
            <th className="micro-label py-2.5 pr-4 font-semibold">Exposure</th>
            <th className="micro-label py-2.5 font-semibold">Deductible</th>
          </tr>
        </thead>
        <tbody className="text-stone-600">
          {timeline.map((p) => (
            <tr key={p.label} className="border-t border-stone-200">
              <td className="py-2.5 pr-4">{p.label}</td>
              <td className="py-2.5 pr-4 tabular-nums">
                {p.fundedPct != null ? `${Math.round(p.fundedPct)}%` : "—"}
              </td>
              <td className="py-2.5 pr-4 tabular-nums">
                {p.exposureCad != null ? cad(p.exposureCad) : "—"}
              </td>
              <td className="py-2.5 tabular-nums">
                {p.deductibleCad != null ? cad(p.deductibleCad) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deltas.length > 0 && (
        <ul className="mt-4 text-sm text-stone-600 leading-relaxed list-none">
          {deltas.slice(0, 4).map((d, i) => (
            <li key={i} className="border-t border-stone-200 py-2">
              <span className="font-semibold text-ink">{d.label}:</span> {d.detail}
            </li>
          ))}
        </ul>
      )}

      {/* Flags */}
      <h2 className="font-bold text-xl tracking-tight text-ink mt-12 mb-2">
        Red flags
      </h2>
      {newer.flags.map((f, i) => (
        <div key={i} className="border-t border-stone-300 py-4 break-inside-avoid">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="micro-label font-bold text-ink uppercase">
              {f.severity}
            </span>
            <span className="font-bold text-ink">{f.title}</span>
            {f.money_exposure?.amount_cad != null && (
              <span className="tabular-nums font-bold text-signal">
                {cad(f.money_exposure.amount_cad)}
              </span>
            )}
            {f.downgraded && (
              <span className="micro-label text-stone-500">
                Downgraded — claim could not be verified
              </span>
            )}
          </div>
          <p className="text-stone-600 leading-relaxed mt-1.5 text-sm">
            {f.explanation}
          </p>
          {f.evidence[0] && (
            <p className="text-[13px] text-stone-500 leading-relaxed mt-1.5">
              “{f.evidence[0].quote_display || f.evidence[0].quote}” —{" "}
              {f.evidence[0].document_name}, p. {f.evidence[0].page}
            </p>
          )}
        </div>
      ))}

      {/* Questions */}
      {newer.questions_for_realtor_lawyer.length > 0 && (
        <>
          <h2 className="font-bold text-xl tracking-tight text-ink mt-12 mb-3">
            Questions to resolve before conditions come off
          </h2>
          <ol className="list-decimal ml-5 text-sm text-stone-600 leading-relaxed space-y-1.5">
            {newer.questions_for_realtor_lawyer.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </>
      )}

      {/* Audit trail */}
      <h2 className="font-bold text-xl tracking-tight text-ink mt-12 mb-2">
        Verification audit trail
      </h2>
      <p className="text-sm text-stone-600 mb-3">
        {audit.verified} of {audit.total} claims verified against the
        documents.
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-t-2 border-ink text-left">
            <th className="micro-label py-2 pr-3 font-semibold">Claim</th>
            <th className="micro-label py-2 pr-3 font-semibold">Source</th>
            <th className="micro-label py-2 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody className="text-stone-600">
          {auditRows.map((r, i) => (
            <tr key={i} className="border-t border-stone-200 align-top">
              <td className="py-2 pr-3">{r.flagTitle}</td>
              <td className="py-2 pr-3">
                {r.documentName}, p. {r.claimedPage}
              </td>
              <td className="py-2">
                {r.verified
                  ? `✓ Verified — ${MATCH_LABELS[r.matchType]}`
                  : "⚠ Not verified — downgraded"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[12px] text-stone-500 leading-relaxed mt-12 border-t border-stone-300 pt-4">
        ClearCondo summarizes documents; it is not legal or financial
        advice. Sample report — the building, documents, and figures on this
        page are fictional demonstration data.
      </p>
    </div>
  );
}
