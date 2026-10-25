export type SeverityMix = { critical: number; warning: number; info: number };

const SEVERITY_BAR: [keyof SeverityMix, string, string][] = [
  ["critical", "bg-signal", "critical"],
  ["warning", "bg-warn", "warning"],
  ["info", "bg-info", "info"],
];

/** The report's flags by severity, as one stacked bar with counts. */
export default function SeverityBar({ mix }: { mix: SeverityMix }) {
  const total = mix.critical + mix.warning + mix.info;
  if (total === 0) return <div className="text-[13px] text-subtle">No flags</div>;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bar-in" aria-hidden>
        {SEVERITY_BAR.filter(([k]) => mix[k] > 0).map(([k, cls]) => (
          <span key={k} className={cls} style={{ width: `${(mix[k] / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[12px] text-stone-600">
        {SEVERITY_BAR.filter(([k]) => mix[k] > 0).map(([k, cls, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-[2px] ${cls}`} aria-hidden />
            {mix[k]} {label}
          </span>
        ))}
      </div>
    </div>
  );
}
