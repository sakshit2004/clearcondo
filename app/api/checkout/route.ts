import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isStripeEnabled, isDbConfigured } from "@/lib/db";
import { getStripe, reportPriceCents, appUrl } from "@/lib/stripe";

/**
 * Create a Stripe Checkout session for one report credit.
 * Only active when STRIPE_ENABLED=true (test mode). Otherwise 404.
 */
export async function GET(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json(
      { error: "Payments are disabled on this deployment." },
      { status: 404 }
    );
  }
  if (!isClerkConfigured() || !isDbConfigured()) {
    return NextResponse.json(
      { error: "Checkout requires auth and database configuration." },
      { status: 503 }
    );
  }
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: "ClearCondo report credit",
            description: "One AI red-flag analysis of a condo document stack.",
          },
          unit_amount: reportPriceCents(),
        },
        quantity: 1,
      },
    ],
    metadata: { owner_id: userId, credits: "1" },
    success_url: `${appUrl()}/app/new?purchase=success`,
    cancel_url: `${appUrl()}/app/new?purchase=cancelled`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create a checkout session." },
      { status: 502 }
    );
  }
  return NextResponse.redirect(session.url);
}
