import type { Severity } from "@/lib/report-schema";
import { SEVERITY_LABELS } from "@/lib/report-schema";

const STYLES: Record<Severity, string> = {
  critical: "bg-red-50 text-red-800 border-red-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  info: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
