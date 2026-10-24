import type { Metadata } from "next";
import { ownerBill } from "@/lib/owner-bills";
import ComingSoonBill from "@/components/owner/ComingSoonBill";

const bill = ownerBill("insurance");

export const metadata: Metadata = {
  title: `${bill.title} (coming soon) — ClearCondo`,
  description: bill.summary,
};

/** Owner dashboard tab: insurance. Coming soon. */
export default function InsurancePage() {
  return <ComingSoonBill bill={bill} />;
}
