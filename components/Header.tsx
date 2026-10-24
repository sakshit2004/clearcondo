import Link from "next/link";
import { Suspense } from "react";
import { isClerkConfigured } from "@/lib/auth";
import { Show, UserButton } from "@clerk/nextjs";
import Logo from "./Logo";

export default function Header() {
  const configured = isClerkConfigured();
  return (
    // On the landing page the hero restyles this bar via CSS
    // (body:has(.landing-hero) .site-header in globals.css).
    <header className="site-header bg-white/90 backdrop-blur sticky top-0 z-40 border-b border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 header-row flex items-center justify-between gap-4">
        <Link href="/" aria-label="ClearCondo home" className="header-logo">
          <Logo size={28} animate />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6" aria-label="Main">
          {/* The two doors, always visible: buying and owning. */}
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="header-cta btn-lift bg-ink hover:bg-accent text-white text-[14px] sm:text-[15px] font-semibold px-3 sm:px-4 min-h-10 sm:min-h-11 inline-flex items-center rounded-lg whitespace-nowrap"
            >
              <span className="sm:hidden">Buying</span>
              <span className="hidden sm:inline">For buyers</span>
            </Link>
            <Link
              href="/app/own"
              className="header-cta-alt btn-lift border border-line2 hover:border-ink text-ink text-[14px] sm:text-[15px] font-semibold px-3 sm:px-4 min-h-10 sm:min-h-11 inline-flex items-center rounded-lg whitespace-nowrap transition-colors"
            >
              <span className="sm:hidden">Owning</span>
              <span className="hidden sm:inline">For owners</span>
            </Link>
          </div>
          {configured ? (
            /* Auth state is runtime data: under Cache Components the
               static shell (including /_not-found) can only prerender
               with the auth controls behind a Suspense boundary. */
            <Suspense fallback={null}>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="nav-link hidden sm:inline text-[15px] text-muted hover:text-ink whitespace-nowrap transition-colors"
                >
                  Sign in
                </Link>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </Suspense>
          ) : (
            <span className="header-chip hidden sm:inline rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-subtle whitespace-nowrap">
              Auth not configured
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
