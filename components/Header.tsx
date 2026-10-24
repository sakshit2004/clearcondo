import Link from "next/link";
import { Suspense } from "react";
import { isClerkConfigured } from "@/lib/auth";
import { Show, UserButton } from "@clerk/nextjs";
import Logo from "./Logo";

const navLink =
  "nav-link hidden sm:inline text-[15px] text-muted hover:text-ink transition-colors";

export default function Header() {
  const configured = isClerkConfigured();
  return (
    <header className="bg-white/90 backdrop-blur sticky top-0 z-40 border-b border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" aria-label="ClearCondo home">
          <Logo size={28} animate />
        </Link>
        <nav className="flex items-center gap-5 sm:gap-7">
          <Link href="/#how" className={navLink}>
            How it works
          </Link>
          <Link href="/demo" className={navLink}>
            Sample report
          </Link>
          <Link href="/order" className={navLink}>
            Order a report
          </Link>
          {configured ? (
            /* Auth state is runtime data: under Cache Components the
               static shell (including /_not-found) can only prerender
               with the auth controls behind a Suspense boundary. */
            <Suspense fallback={null}>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="nav-link text-[15px] text-muted hover:text-ink whitespace-nowrap transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/app/new"
                  className="btn-lift bg-ink hover:bg-accent text-white text-[15px] font-semibold px-4 min-h-11 inline-flex items-center rounded-lg whitespace-nowrap"
                >
                  Analyze documents
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/app"
                  className="nav-link text-[15px] text-muted hover:text-ink whitespace-nowrap transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </Suspense>
          ) : (
            <span className="rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-subtle whitespace-nowrap">
              Auth not configured
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
