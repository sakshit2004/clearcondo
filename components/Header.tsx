import Link from "next/link";
import { isClerkConfigured } from "@/lib/auth";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Header() {
  const configured = isClerkConfigured();
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-sm">
            CC
          </span>
          <span className="font-semibold text-lg tracking-tight text-stone-900">
            ClearCondo
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          <Link
            href="/demo"
            className="text-stone-600 hover:text-stone-900 px-2 py-1"
          >
            Sample report
          </Link>
          {configured ? (
            <>
              <SignedOut>
                <Link
                  href="/sign-in"
                  className="text-stone-600 hover:text-stone-900 px-2 py-1"
                >
                  Sign in
                </Link>
                <Link
                  href="/app/new"
                  className="bg-teal-800 hover:bg-teal-900 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Analyze documents
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/app"
                  className="text-stone-600 hover:text-stone-900 px-2 py-1"
                >
                  Dashboard
                </Link>
                <UserButton />
              </SignedIn>
            </>
          ) : (
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              Auth not configured
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
