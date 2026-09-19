/**
 * @jest-environment node
 */
import {
  getStripeMode,
  getStripeSecretKey,
  getStripePublishableKey,
  isStripeConfigured,
  getStripePublicConfig,
  STRIPE_MODES,
} from "../../config/stripe.js";

describe("config/stripe", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  function clearStripeEnv() {
    delete process.env.STRIPE_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY_TEST;
    delete process.env.STRIPE_SECRET_KEY_LIVE;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY_TEST;
    delete process.env.STRIPE_PUBLISHABLE_KEY_LIVE;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_TEST;
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  }

  test("defaults to test mode", () => {
    clearStripeEnv();
    expect(getStripeMode()).toBe(STRIPE_MODES.TEST);
  });

  test("respects STRIPE_MODE=live", () => {
    clearStripeEnv();
    process.env.STRIPE_MODE = "live";
    process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_abc";
    expect(getStripeMode()).toBe(STRIPE_MODES.LIVE);
    expect(getStripeSecretKey()).toBe("sk_live_abc");
  });

  test("picks test vs live secrets by mode", () => {
    clearStripeEnv();
    process.env.STRIPE_MODE = "test";
    process.env.STRIPE_SECRET_KEY_TEST = "sk_test_aaa";
    process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_bbb";
    process.env.STRIPE_PUBLISHABLE_KEY_TEST = "pk_test_aaa";
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE = "pk_live_bbb";
    expect(getStripeSecretKey()).toBe("sk_test_aaa");
    expect(getStripePublishableKey()).toBe("pk_test_aaa");
    process.env.STRIPE_MODE = "live";
    expect(getStripeSecretKey()).toBe("sk_live_bbb");
    expect(getStripePublishableKey()).toBe("pk_live_bbb");
  });

  test("isStripeConfigured and public config", () => {
    clearStripeEnv();
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_SECRET_KEY_TEST = "sk_test_x";
    process.env.STRIPE_PUBLISHABLE_KEY_TEST = "pk_test_x";
    expect(isStripeConfigured()).toBe(true);
    const pub = getStripePublicConfig();
    expect(pub.mode).toBe("test");
    expect(pub.configured).toBe(true);
    expect(pub.publishableKey).toBe("pk_test_x");
    expect(pub).not.toHaveProperty("secretKey");
  });
});
