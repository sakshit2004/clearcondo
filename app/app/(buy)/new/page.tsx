import { redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isStripeEnabled, withDb, getCreditBalance } from "@/lib/db";
import SetupNotice from "@/components/SetupNotice";
import UploadForm from "@/components/UploadForm";


export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string | string[] }>;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const stripeEnabled = isStripeEnabled();
  let credits: number | null = null;
  if (stripeEnabled) {
    credits = await withDb((db) => getCreditBalance(db, userId));
  }

  const { building } = await searchParams;
  const initialBuildingName = (typeof building === "string" ? building : "").trim().slice(0, 120);

  return (
    <UploadForm
      stripeEnabled={stripeEnabled}
      credits={credits}
      initialBuildingName={initialBuildingName}
    />
  );
}
