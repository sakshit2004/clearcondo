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
      {children}
    </div>
  );
}
