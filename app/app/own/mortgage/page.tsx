import type { Metadata } from "next";
import { ownerBill } from "@/lib/owner-bills";
import ComingSoonBill from "@/components/owner/ComingSoonBill";

const bill = ownerBill("mortgage");

export const metadata: Metadata = {
  title: `${bill.title} (coming soon) — ClearCondo`,
  description: bill.summary,
};

/** Owner dashboard tab: mortgage. Coming soon. */
export default function MortgagePage() {
  return <ComingSoonBill bill={bill} />;
}
