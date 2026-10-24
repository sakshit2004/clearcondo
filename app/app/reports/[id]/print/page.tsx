import { notFound, redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { loadReportVM } from "@/lib/report-loader";
import SetupNotice from "@/components/SetupNotice";
import ReportPrint from "@/components/ReportPrint";

/**
 * The PDF version of one of the user's reports. ?for= and ?brokerage=
 * put a client and realtor on the first page; ?download=1 opens the
 * print dialog on arrival (Save as PDF).
 */
export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string; brokerage?: string; download?: string }>;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  if (!isDbConfigured()) return notFound();

  const { id } = await params;
  const sp = await searchParams;
  const vm = await loadReportVM(userId, id);
  if (!vm) return notFound();

  return (
    <ReportPrint
      analysis={vm.analysis}
      buildingName={vm.buildingName}
      buildingMeta={vm.buildingMeta}
      createdAt={vm.createdAt}
      preparedFor={sp.for?.slice(0, 120) || undefined}
      brokerage={sp.brokerage?.slice(0, 120) || undefined}
      timeline={vm.timeline}
      deltas={vm.deltas}
      missing={vm.missing}
      backHref={`/app/reports/${id}`}
      backLabel="Back to the interactive report"
      autoPrint={sp.download === "1"}
    />
  );
}
