import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isTestStripeKey, getStripe } from "../stripe.ts";
import { isStripeEnabled } from "../db.ts";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.STRIPE_ENABLED;
  delete process.env.STRIPE_SECRET_KEY;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("Stripe test-mode enforcement", () => {
  it("accepts sk_test_ keys", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    assert.equal(isTestStripeKey(), true);
  });
  it("rejects live keys and refuses to initialize", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    assert.equal(isTestStripeKey(), false);
    assert.throws(() => getStripe(), /non-test key/);
  });
  it("rejects missing/empty keys", () => {
    assert.equal(isTestStripeKey(), false);
    assert.throws(() => getStripe(), /not set/);
  });
  it("isStripeEnabled requires STRIPE_ENABLED=true AND a test key", () => {
    process.env.STRIPE_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    assert.equal(isStripeEnabled(), true);
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    assert.equal(isStripeEnabled(), false);
    process.env.STRIPE_ENABLED = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    assert.equal(isStripeEnabled(), false);
  });
});
