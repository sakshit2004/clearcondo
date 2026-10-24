import { notFound, redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { loadReportVM } from "@/lib/report-loader";
import SetupNotice from "@/components/SetupNotice";
import DeleteReportButton from "@/components/DeleteReportButton";
import ReportView, { ReportToolbar } from "@/components/ReportView";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  if (!isDbConfigured()) return notFound();

  const { id } = await params;
  const vm = await loadReportVM(userId, id);
  if (!vm) return notFound();

  const pdfHref = `/app/reports/${id}/print?download=1`;

  return (
    <div>
      <ReportToolbar backHref="/app" backLabel="All reports" pdfHref={pdfHref} />
      <ReportView report={vm} pdfHref={pdfHref} storageKey={id} />
      <div className="mt-10 pt-6 border-t border-line">
        <DeleteReportButton reportId={id} />
      </div>
    </div>
  );
}
