import { Suspense } from "react";
import DashboardTabs, { TabLinks, type Tab } from "./DashboardTabs";
import { OWNER_BILLS } from "@/lib/owner-bills";

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
        <Suspense fallback={<TabLinks tabs={d.links} active={null} />}>
          <DashboardTabs tabs={d.links} />
        </Suspense>
      </div>
    </nav>
  );
}
