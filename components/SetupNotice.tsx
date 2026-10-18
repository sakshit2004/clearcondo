import Link from "next/link";

/** Shown on auth-gated routes when Clerk env vars are missing. */
export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900 mb-2">
          Authentication isn&apos;t configured
        </h1>
        <p className="text-sm text-amber-800 mb-4">
          This deployment is missing its Clerk keys. Add
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          </code>
          and
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            CLERK_SECRET_KEY
          </code>
          to the environment to enable sign-in. See the README for the full
          setup checklist.
        </p>
        <Link
          href="/demo"
          className="text-sm font-semibold text-amber-900 underline"
        >
          View the sample report instead →
        </Link>
      </div>
    </div>
  );
}
