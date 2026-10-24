import DashboardNav from "@/components/DashboardNav";

/** The buyer dashboard: its own nav, linked to the other only by the switch. */
export default function BuyerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNav kind="buy" />
      {children}
    </>
  );
}
