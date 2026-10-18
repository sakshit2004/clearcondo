import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

const withClerk = clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) await auth.protect();
});

/**
 * Next 16 uses `proxy.ts` instead of `middleware.ts`.
 * When Clerk keys are absent we pass requests through so the landing page,
 * /demo, and setup notices still render (graceful degradation for review).
 */
export function proxy(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  // Clerk's handler expects the middleware (request, event) signature;
  // proxy only receives the request, so we shim a minimal event.
  return withClerk(req, { waitUntil: () => {} } as unknown as NextFetchEvent);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
