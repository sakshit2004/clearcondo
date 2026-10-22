import Link from "next/link";
import { withDb, getServiceOrderByRef, isDbConfigured } from "@/lib/db";
import {
  isRefCode,
  normalizeRefCode,
  statusLabel,
  statusDescription,
} from "@/lib/service-order";

/**
 * Public order status, addressed by reference code alone — the sender has
 * no account to sign into. Shows what was received, where the order
 * stands, and where the finished report will go. Document TEXT is never
 * shown here; only the package manifest.
 */
export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const refCode = normalizeRefCode(ref);

  const order =
    isRefCode(refCode) && isDbConfigured()
      ? await withDb((db) => getServiceOrderByRef(db, refCode))
      : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <div className="micro-label text-stone-500 mb-3">Order status</div>
        <h1 className="font-bold text-3xl tracking-tight text-ink">
          We couldn&apos;t find {refCode}
        </h1>
        <p className="text-stone-600 leading-relaxed mt-4 max-w-xl">
          Check the reference code on your confirmation and try again. If
          the package was just sent, give it a moment — or send it again
          from the order page.
        </p>
        <Link
          href="/order"
          className="inline-block mt-7 font-semibold text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
        >
          Go to the order desk →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <div className="micro-label text-stone-500 mb-3">Order status</div>
      <h1 className="font-bold text-4xl tracking-tight text-ink tabular-nums">
        {order.refCode}
      </h1>

      <div className="border border-ink bg-white p-6 sm:p-8 mt-8">
        <div className="micro-label bg-ink text-white inline-block px-2 py-1">
          {statusLabel(order.status)}
        </div>
        <p className="text-stone-600 leading-relaxed mt-4">
          {statusDescription(order.status)}
        </p>
        <table className="w-full text-sm mt-6">
          <tbody className="text-stone-600">
            <tr className="border-t border-stone-200">
              <td className="py-2.5 pr-4 font-semibold text-ink w-40">Property</td>
              <td className="py-2.5">{order.propertyAddress}</td>
            </tr>
            <tr className="border-t border-stone-200">
              <td className="py-2.5 pr-4 font-semibold text-ink">Ordered by</td>
              <td className="py-2.5">
                {order.realtorName}
                {order.brokerage ? ` · ${order.brokerage}` : ""}
              </td>
            </tr>
            <tr className="border-t border-stone-200">
              <td className="py-2.5 pr-4 font-semibold text-ink">Report goes to</td>
              <td className="py-2.5">{order.email}</td>
            </tr>
            {order.conditionDate && (
              <tr className="border-t border-stone-200">
                <td className="py-2.5 pr-4 font-semibold text-ink">
                  Conditions by
                </td>
                <td className="py-2.5">{order.conditionDate}</td>
              </tr>
            )}
            <tr className="border-t border-b border-stone-200">
              <td className="py-2.5 pr-4 font-semibold text-ink">Received</td>
              <td className="py-2.5">
                {new Date(order.createdAt).toLocaleString("en-CA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="micro-label text-stone-500 mt-8 mb-2">
          Package — {order.documents.length} document
          {order.documents.length === 1 ? "" : "s"}
        </div>
        <table className="w-full text-sm">
          <tbody className="text-stone-600">
            {order.documents.map((d) => (
              <tr key={d.filename} className="border-t border-stone-200">
                <td className="py-2 pr-4">{d.filename}</td>
                <td className="py-2 text-right tabular-nums">
                  {d.pageCount} pages
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[13px] text-stone-500 leading-relaxed mt-6">
        This page shows the order manifest only — never the documents&apos;
        contents. Extracted text is deleted after 30 days under the same
        retention rule as the app.
      </p>
    </div>
  );
}
