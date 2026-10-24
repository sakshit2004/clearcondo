import DashboardNav from "@/components/DashboardNav";

/** The owner dashboard: its own nav, linked to the other only by the switch. */
export default function OwnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNav kind="own" />
      {children}
    </>
  );
}
