import Link from "next/link";
import { LogoMark } from "./Logo";

/** Shown on auth-gated routes when Clerk env vars are missing. */
export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="report-paper rounded-2xl p-7">
        <LogoMark size={36} />
        <h1 className="mt-5 text-xl font-bold">Authentication isn&apos;t configured</h1>
        <p className="text-[15px] text-muted mt-2 mb-5 leading-relaxed">
          This deployment is missing its Clerk keys. Add
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          </code>
          and
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
            CLERK_SECRET_KEY
          </code>
          to the environment to enable sign-in. See the README for the full
          setup checklist.
        </p>
        <Link href="/demo" className="text-[15px] font-semibold text-accent hover:text-accent-dark">
          View the sample report instead →
        </Link>
      </div>
    </div>
  );
}
