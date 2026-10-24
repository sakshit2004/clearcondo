import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";
import { LogoMark } from "@/components/Logo";

export default function SignUpPage() {
  if (!isClerkConfigured()) return <SetupNotice />;
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-md px-4 py-14 flex flex-col items-center gap-6">
        <LogoMark size={44} animate />
        <SignUp />
      </div>
    </div>
  );
}
