import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <nav className="flex gap-1 mb-8 border-b border-stone-200">
        {[
          { href: "/app", label: "Reports" },
          { href: "/app/buildings", label: "Buildings" },
          { href: "/app/new", label: "New analysis" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 border-b-2 border-transparent hover:border-stone-300 -mb-px"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
