import { redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isStripeEnabled, withDb, getCreditBalance } from "@/lib/db";
import SetupNotice from "@/components/SetupNotice";
import UploadForm from "@/components/UploadForm";


export default async function NewAnalysisPage() {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const stripeEnabled = isStripeEnabled();
  let credits: number | null = null;
  if (stripeEnabled) {
    credits = await withDb((db) => getCreditBalance(db, userId));
  }

  return <UploadForm stripeEnabled={stripeEnabled} credits={credits} />;
}
