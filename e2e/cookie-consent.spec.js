/**
 * E2E Tests for Cookie Consent Flow
 * 
 * Tests GDPR-compliant cookie consent behavior:
 * - Banner visibility on first visit
 * - Accept flow (hides banner, stores consent, allows analytics)
 * - Reject flow (hides banner, blocks analytics)
 * - Persistence across page reloads
 * - No analytics without consent
 * 
 * @see https://playwright.dev/docs/test-assertions
 */

const { test, expect } = require("@playwright/test");

const CONSENT_KEY = "cookie-consent";

test.describe("Cookie Consent", () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage before each test to ensure clean state
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("should show cookie banner on first visit", async ({ page }) => {
    await page.goto("/");
    
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    
    // Cookie banner should be visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    
    // Accept and reject buttons should be present
    await expect(page.getByTestId("cookie-accept-btn")).toBeVisible();
    await expect(page.getByTestId("cookie-reject-btn")).toBeVisible();
  });

  test("should hide banner and store consent when Accept is clicked", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Verify banner is visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    
    // Click Accept button
    await page.getByTestId("cookie-accept-btn").click();
    
    // Banner should be hidden
    await expect(banner).not.toBeVisible();
    
    // Verify consent is stored in localStorage
    const consent = await page.evaluate(() => {
      return window.localStorage.getItem("cookie-consent");
    });
    expect(consent).toBe("accepted");
  });

  test("should hide banner and store rejection when Reject is clicked", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Verify banner is visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    
    // Click Reject button
    await page.getByTestId("cookie-reject-btn").click();
    
    // Banner should be hidden
    await expect(banner).not.toBeVisible();
    
    // Verify rejection is stored in localStorage
    const consent = await page.evaluate(() => {
      return window.localStorage.getItem("cookie-consent");
    });
    expect(consent).toBe("rejected");
  });

  test("should NOT show banner on reload after accepting", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Accept cookies
    await page.getByTestId("cookie-accept-btn").click();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Banner should NOT be visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).not.toBeVisible();
  });

  test("should NOT show banner on reload after rejecting", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Reject cookies
    await page.getByTestId("cookie-reject-btn").click();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Banner should NOT be visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).not.toBeVisible();
  });

  test("should NOT load analytics scripts before consent", async ({ page }) => {
    // Track all network requests
    const analyticsRequests = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("googletagmanager") || url.includes("google-analytics")) {
        analyticsRequests.push(url);
      }
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // No analytics requests should have been made
    expect(analyticsRequests).toHaveLength(0);
    
    // Verify no gtag script in DOM
    const gtagScript = await page.$('script[src*="googletagmanager"]');
    expect(gtagScript).toBeNull();
  });

  test("should NOT load analytics after rejection", async ({ page }) => {
    // Track all network requests
    const analyticsRequests = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("googletagmanager") || url.includes("google-analytics")) {
        analyticsRequests.push(url);
      }
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Reject cookies
    await page.getByTestId("cookie-reject-btn").click();
    
    // Wait a bit for any potential analytics loading
    await page.waitForTimeout(1000);
    
    // No analytics requests should have been made
    expect(analyticsRequests).toHaveLength(0);
  });

  test("consent should persist across different pages", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Accept cookies
    await page.getByTestId("cookie-accept-btn").click();
    
    // Navigate to a different page
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    
    // Banner should NOT be visible
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).not.toBeVisible();
    
    // Consent should still be stored
    const consent = await page.evaluate(() => {
      return window.localStorage.getItem("cookie-consent");
    });
    expect(consent).toBe("accepted");
  });
});

test.describe("Cookie Consent - Analytics Integration", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("analytics should only initialize after acceptance (when GA_ID is set)", async ({ page }) => {
    // This test verifies the consent gate logic
    // Even without a real GA ID, we can verify the component behavior
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Before consent: verify no gtag
    let hasGtag = await page.evaluate(() => {
      return typeof window.gtag === "function";
    });
    expect(hasGtag).toBe(false);
    
    // Accept consent
    await page.getByTestId("cookie-accept-btn").click();
    
    // Wait for potential script loading
    await page.waitForTimeout(500);
    
    // Note: after accept, gtag is injected when Analytics has a GA env ID and/or Google Ads ID (see Analytics.js)
    // This test primarily verifies the consent flow works correctly
    const consent = await page.evaluate(() => {
      return window.localStorage.getItem("cookie-consent");
    });
    expect(consent).toBe("accepted");
  });
});

test.describe("Cookie Banner i18n", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("should display English text by default", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    
    // Check for English text
    await expect(banner).toContainText("Cookie Consent");
    await expect(banner).toContainText("Accept");
    await expect(banner).toContainText("Reject");
  });

  // Note: Language switching tests would require setting up i18n state
  // These can be expanded once the language switching mechanism is confirmed
});
