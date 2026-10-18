/**
 * GET /api/health
 *
 * Deployment health probe: reports which backing services are configured.
 * Values are BOOLEANS ONLY — never secret values, never key prefixes.
 * Safe to hit from uptime monitors and Vercel deployment checks.
 * Intentionally public: proxy.ts only auth-gates /app/*, not /api/*.
 */
import { NextResponse, connection } from "next/server";
import { isClerkConfigured } from "@/lib/auth";
import { isAnthropicConfigured } from "@/lib/analyze";
import { isDbConfigured, isStripeEnabled } from "@/lib/db";
import { isAgentMemoryConfigured } from "@/lib/agent-memory";

export async function GET() {
  // Request-time evaluation: env vars may differ between build and runtime.
  // (The `connection()` call is the cacheComponents-compatible replacement
  // for `export const dynamic = "force-dynamic"`.)
  await connection();
  const services = {
    clerk: isClerkConfigured(),
    anthropic: isAnthropicConfigured(),
    surrealdb: isDbConfigured(),
    agent_memory: isAgentMemoryConfigured(),
    stripe: isStripeEnabled(),
  };
  const ok = services.clerk && services.anthropic;
  return NextResponse.json({
    status: ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services,
    // Degraded (not down) when core services are missing:
    // the app renders landing + /demo + setup notices without them.
    note: ok
      ? undefined
      : "Core services missing — app runs in degraded mode (landing + /demo + setup notices only).",
  });
}
