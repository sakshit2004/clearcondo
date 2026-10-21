import type { Severity } from "@/lib/report-schema";
import { SEVERITY_LABELS } from "@/lib/report-schema";

const STYLES: Record<Severity, string> = {
  critical: "bg-signal text-white",
  warning: "bg-ink text-white",
  info: "bg-white text-stone-500 border border-stone-300",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`micro-label inline-flex items-center px-2 py-1 ${STYLES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
