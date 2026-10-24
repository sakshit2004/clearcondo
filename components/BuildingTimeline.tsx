import { cad } from "@/lib/format";
import { fundedDelta, sortPoints, type TimelinePoint } from "@/lib/timeline";

/**
 * Building risk timeline — reserve health, exposure, and deductible
 * across every review of the same building. The compounding memory,
 * drawn as one strip. Bars are blue; orange appears only below the 70%
 * funded threshold the reserve studies themselves call "good".
 */
export default function BuildingTimeline({
  points,
}: {
  points: TimelinePoint[];
}) {
  const sorted = sortPoints(points);
  if (sorted.length < 2) return null;

  return (
    <section className="report-paper p-6 sm:p-8">
      <div className="micro-label text-stone-400 mb-2">Building memory</div>
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-6">
        Risk over time
      </h2>
      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))`,
        }}
      >
        {sorted.map((p, i) => {
          const delta = fundedDelta(sorted, i);
          const below =
            p.fundedPct != null && p.fundedPct < 70;
          return (
            <div key={i} className="border-t-2 border-line pt-4 min-w-0">
              <div className="data-label text-stone-500 mb-3">{p.label}</div>
              {p.fundedPct != null ? (
                <>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[34px] leading-none font-bold text-ink tabular-nums tracking-[-0.02em]">
                      {p.fundedPct.toFixed(0)}%
                    </span>
                    <span className="micro-label text-stone-400">
                      reserve funded
                    </span>
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden bg-stone-100 mt-3 mb-2">
                    <div
                      className={`grow-x h-full rounded-full ${below ? "bg-signal" : "bg-accent"}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, p.fundedPct))}%`,
                      }}
                    />
                  </div>
                  {delta != null && (
                    <div
                      className={`text-[13px] font-semibold tabular-nums ${
                        delta < 0 ? "text-signal" : "text-stone-500"
                      }`}
                    >
                      {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
                      {Math.abs(delta).toFixed(1)} pts since previous review
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-stone-400">
                  Reserve funding not stated
                </div>
              )}
              <dl className="mt-4 space-y-1.5 text-sm">
                {p.reserveBalanceCad != null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-400">Reserve</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {cad(p.reserveBalanceCad)}
                    </dd>
                  </div>
                )}
                {p.exposureCad != null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-400">Exposure</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {cad(p.exposureCad)}
                    </dd>
                  </div>
                )}
                {p.deductibleCad != null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-400">Deductible</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {cad(p.deductibleCad)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
