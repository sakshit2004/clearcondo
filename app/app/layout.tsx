import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";

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
      <nav className="flex gap-1 mb-8 border-b border-line">
        {[
          { href: "/app", label: "Reports" },
          { href: "/app/buildings", label: "Buildings" },
          { href: "/app/new", label: "New analysis" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[15px] font-medium px-4 py-3 text-muted hover:text-ink border-b-2 border-transparent hover:border-accent -mb-px transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
