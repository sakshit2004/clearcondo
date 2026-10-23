import Link from "next/link";
import { isClerkConfigured } from "@/lib/auth";
import { Show, UserButton } from "@clerk/nextjs";

export default function Header() {
  const configured = isClerkConfigured();
  return (
    <header className="bg-white sticky top-0 z-40 border-b border-ink">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="w-2.5 h-2.5 bg-signal inline-block translate-y-[-1px]" aria-hidden />
          <span className="font-bold text-[17px] tracking-tight text-ink">
            ClearCondo
          </span>
        </Link>
        <nav className="flex items-center gap-5 sm:gap-7">
          <Link
            href="/order"
            className="micro-label hidden sm:inline text-stone-500 hover:text-ink transition-colors"
          >
            Order a report
          </Link>
          <Link
            href="/demo"
            className="micro-label hidden sm:inline text-stone-500 hover:text-ink transition-colors"
          >
            Sample report
          </Link>
          {configured ? (
            <>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="micro-label text-stone-500 hover:text-ink whitespace-nowrap transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/app/new"
                  className="bg-ink hover:bg-signal text-white micro-label px-4 py-2.5 whitespace-nowrap transition-colors"
                >
                  Analyze documents
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/app"
                  className="micro-label text-stone-500 hover:text-ink whitespace-nowrap transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </>
          ) : (
            <span className="micro-label text-stone-500 border border-stone-300 px-3 py-1.5 whitespace-nowrap">
              Auth not configured
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
