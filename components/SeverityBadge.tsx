import type { Severity } from "@/lib/report-schema";
import { SEVERITY_LABELS } from "@/lib/report-schema";

const STYLES: Record<Severity, string> = {
  critical: "bg-[#d92d20] text-white",
  warning: "bg-[#ffb020] text-ink",
  info: "bg-stone-200 text-stone-600",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`micro-label inline-flex items-center rounded-[4px] px-2 py-1 font-bold ${STYLES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
