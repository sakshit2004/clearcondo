import type { Severity } from "@/lib/report-schema";
import { SEVERITY_LABELS } from "@/lib/report-schema";

const STYLES: Record<Severity, string> = {
  critical: "bg-signal-soft text-signal-dark",
  warning: "bg-warn-soft text-warn-dark",
  info: "bg-info-soft text-info-dark",
};

/** Solid swatch colors for bars and legends, one per severity. */
export const SEVERITY_SWATCH: Record<Severity, string> = {
  critical: "bg-signal",
  warning: "bg-warn",
  info: "bg-info",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${STYLES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
