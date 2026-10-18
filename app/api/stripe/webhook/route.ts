import { NextResponse } from "next/server";
import { isStripeEnabled, withDb, addCredits } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const maxDuration = 30;

/**
 * Stripe webhook: credits the buyer's account when checkout completes.
 * Verify with the raw body + STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "Payments disabled." }, { status: 404 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const ownerId = session.metadata?.owner_id;
    const credits = parseInt(session.metadata?.credits || "1", 10);
    if (ownerId && session.payment_status === "paid") {
      await withDb((db) => addCredits(db, ownerId, credits));
    }
  }

  return NextResponse.json({ received: true });
}
