import { auth } from "@clerk/nextjs/server";

/** True when Clerk is configured (both keys present). */
export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  );
}

/**
 * Returns the signed-in user's id, or null when Clerk is not configured.
 * Routes that require auth should redirect to /sign-in when this is null
 * AND Clerk is configured; when Clerk is not configured they should render
 * the setup notice instead.
 */
export async function getUserId(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  const { userId } = await auth();
  return userId;
}
