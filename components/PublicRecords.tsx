import { loadPublicRecordCheck } from "@/lib/public-records-loader";
import PublicRecordsSection, { PUBLIC_RECORDS_LABEL, PUBLIC_RECORDS_SUBLABEL } from "./PublicRecordsSection";

/**
 * Server-only: loads and renders the public record check for one report.
 * Rendered inside <Suspense> so a slow City API never holds up the report.
 * Renders nothing for buildings clearly outside Calgary, or if our own
 * database fails (City failures render as "City data unavailable").
 */
export default async function PublicRecords({ userId, reportId }: { userId: string; reportId: string }) {
  let check;
  try {
    check = await loadPublicRecordCheck(userId, reportId);
  } catch {
    return null;
  }
  if (!check) return null;
  return <PublicRecordsSection check={check} />;
}

export function PublicRecordsPending() {
  return (
    <section className="report-paper p-6 sm:p-8" aria-busy="true">
      <div className="micro-label text-stone-400 mb-2">Public record check</div>
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-1.5">
        {PUBLIC_RECORDS_LABEL} <span className="text-subtle font-semibold">{PUBLIC_RECORDS_SUBLABEL}</span>
      </h2>
      <p className="text-sm text-stone-500">Checking City of Calgary open data…</p>
    </section>
  );
}
