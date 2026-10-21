import Link from "next/link";
import { isClerkConfigured } from "@/lib/auth";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Header() {
  const configured = isClerkConfigured();
  return (
    <header className="bg-ink text-white sticky top-0 z-40 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="w-8 h-8 bg-signal text-ink flex items-center justify-center font-display text-sm pt-0.5">
            CC
          </span>
          <span className="font-display text-lg tracking-wide uppercase pt-0.5">
            ClearCondo
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-5">
          <Link
            href="/demo"
            className="micro-label hidden sm:inline text-white/60 hover:text-white px-1 py-1 transition-colors"
          >
            Sample report
          </Link>
          {configured ? (
            <>
              <SignedOut>
                <Link
                  href="/sign-in"
                  className="micro-label text-white/60 hover:text-white px-1 py-1 whitespace-nowrap transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/app/new"
                  className="bg-signal hover:bg-signal-dark text-ink micro-label !text-[11px] font-bold px-4 py-2.5 rounded-full whitespace-nowrap transition-colors"
                >
                  Analyze documents
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/app"
                  className="micro-label text-white/60 hover:text-white px-1 py-1 whitespace-nowrap transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton />
              </SignedIn>
            </>
          ) : (
            <span className="micro-label text-amber-300 border border-amber-300/40 rounded-full px-3 py-1.5 whitespace-nowrap">
              Auth not configured
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
