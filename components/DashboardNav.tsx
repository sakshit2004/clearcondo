import Link from "next/link";
import { OWNER_BILLS } from "@/lib/owner-bills";

type Tab = { href: string; label: string; soon?: boolean };

const DASHBOARDS = {
  buy: {
    label: "Buyer dashboard",
    links: [
      { href: "/app", label: "Reports" },
      { href: "/app/buildings", label: "Buildings" },
      { href: "/app/new", label: "New analysis" },
    ] as Tab[],
  },
  own: {
    label: "Owner dashboard",
    links: [
      { href: "/app/own", label: "Property tax" },
      ...OWNER_BILLS.map((b) => ({ href: `/app/own/${b.slug}`, label: b.tab, soon: true })),
    ] as Tab[],
  },
};

/**
 * One dashboard's nav. Buying and owning are separate dashboards; the
 * header's For buyers / For owners buttons switch between them.
 */
export default function DashboardNav({ kind }: { kind: keyof typeof DASHBOARDS }) {
  const d = DASHBOARDS[kind];
  return (
    <nav className="flex items-end mb-8 border-b border-line" aria-label={d.label}>
      <div className="flex items-end overflow-x-auto max-w-full [scrollbar-width:none]">
        <span
          className={`flex-none mr-3 mb-2.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            kind === "own" ? "bg-ink text-white" : "bg-accent-soft text-accent-dark"
          }`}
        >
          {d.label}
        </span>
        {d.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex-none whitespace-nowrap text-[15px] font-medium px-3 sm:px-4 py-3 text-muted hover:text-ink border-b-2 border-transparent hover:border-accent -mb-px transition-colors"
          >
            {l.label}
            {l.soon && (
              <span className="ml-1.5 rounded bg-info-soft text-info-dark px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide align-middle">
                Soon
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
