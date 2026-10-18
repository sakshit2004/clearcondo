import Stripe from "stripe";

let stripe: Stripe | null = null;

/**
 * This product only ever runs Stripe in test mode. A live key
 * (sk_live_…) would create REAL charges — refuse it loudly instead of
 * charging anyone. Fail closed: anything but sk_test_ disables billing.
 */
export function isTestStripeKey(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!isTestStripeKey()) {
    throw new Error(
      "Refusing to initialize Stripe with a non-test key. ClearCondo billing is test-mode only."
    );
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/** Price in cents for one report credit. Default $49 CAD. */
export function reportPriceCents(): number {
  const raw = process.env.STRIPE_REPORT_PRICE_CENTS;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 4900;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}
