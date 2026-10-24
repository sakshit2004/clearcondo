import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";

/** Buying and owning, side by side: the same app, two jobs. */
const NAV = [
  {
    label: "Buying",
    links: [
      { href: "/app", label: "Reports" },
      { href: "/app/buildings", label: "Buildings" },
      { href: "/app/new", label: "New analysis" },
    ],
  },
  { label: "Owning", links: [{ href: "/app/own", label: "Property tax" }] },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // /app is per-user and DB-backed: defer to request time so Cache
  // Components never probes child pages' DB connections while
  // prerendering (the SurrealDB socket setup trips its check for
  // unstable values — production logs, GET /app).
  await connection();
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <nav className="flex flex-wrap items-end gap-x-6 mb-8 border-b border-line" aria-label="App">
        {NAV.map((group) => (
          <div key={group.label} className="flex items-end">
            <span className="micro-label text-stone-400 pr-2 pb-3.5 hidden sm:inline">{group.label}</span>
            {group.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[15px] font-medium px-3 sm:px-4 py-3 text-muted hover:text-ink border-b-2 border-transparent hover:border-accent -mb-px transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {children}
    </div>
  );
}
