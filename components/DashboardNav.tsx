import Link from "next/link";

const DASHBOARDS = {
  buy: {
    label: "Buyer dashboard",
    links: [
      { href: "/app", label: "Reports" },
      { href: "/app/buildings", label: "Buildings" },
      { href: "/app/new", label: "New analysis" },
    ],
    switchTo: { href: "/app/own", label: "Own a condo instead?" },
  },
  own: {
    label: "Owner dashboard",
    links: [{ href: "/app/own", label: "Property tax" }],
    switchTo: { href: "/app", label: "Buying instead?" },
  },
} as const;

/**
 * One dashboard's nav. Buying and owning are separate dashboards; the
 * only link between them is the switch on the right.
 */
export default function DashboardNav({ kind }: { kind: keyof typeof DASHBOARDS }) {
  const d = DASHBOARDS[kind];
  return (
    <nav className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-8 border-b border-line" aria-label={d.label}>
      <div className="flex flex-wrap items-end">
        <span
          className={`mr-3 mb-2.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            kind === "own" ? "bg-ink text-white" : "bg-accent-soft text-accent-dark"
          }`}
        >
          {d.label}
        </span>
        {d.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[15px] font-medium px-3 sm:px-4 py-3 text-muted hover:text-ink border-b-2 border-transparent hover:border-accent -mb-px transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Link
        href={d.switchTo.href}
        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-line2 hover:border-ink px-3 min-h-9 text-sm font-semibold text-ink transition-colors"
      >
        {d.switchTo.label} <span aria-hidden>→</span>
      </Link>
    </nav>
  );
}
