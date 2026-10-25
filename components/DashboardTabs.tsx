"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; soon?: boolean };

/** The tab whose href is the longest prefix of the path ("/app" owns /app/reports/…). */
function activeHref(path: string, tabs: Tab[]): string | null {
  let best: string | null = null;
  for (const t of tabs) {
    if ((path === t.href || path.startsWith(t.href + "/")) && (!best || t.href.length > best.length)) best = t.href;
  }
  return best;
}

const linkCls =
  "flex-none whitespace-nowrap text-[15px] font-medium px-3 sm:px-4 py-3 border-b-2 -mb-px transition-colors";

export default function DashboardTabs({ tabs }: { tabs: Tab[] }) {
  return <TabLinks tabs={tabs} active={activeHref(usePathname() ?? "", tabs)} />;
}

/** The links themselves; with no active tab when the path isn't known yet. */
export function TabLinks({ tabs, active }: { tabs: Tab[]; active: string | null }) {
  return (
    <>
      {tabs.map((l) => {
        const on = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`${linkCls} ${on ? "text-ink border-accent" : "text-muted border-transparent hover:text-ink hover:border-accent"}`}
          >
            {l.label}
            {l.soon && (
              <span className="ml-1.5 rounded bg-info-soft text-info-dark px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide align-middle">
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
