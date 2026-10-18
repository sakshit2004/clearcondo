import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";

export default function SignInPage() {
  if (!isClerkConfigured()) return <SetupNotice />;
  return (
    <div className="mx-auto max-w-md px-4 py-16 flex justify-center">
      <SignIn />
    </div>
  );
}
