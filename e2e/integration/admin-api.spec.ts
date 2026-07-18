/**
 * Integration tests: real HTTP to Next.js API routes (auth + Mongo as in dev).
 *
 * Prerequisites:
 * - App reachable at PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3026)
 * - Valid admin user (PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD)
 * - MongoDB / env as for local dev
 *
 * Run:
 *   npx playwright test e2e/integration
 *   PLAYWRIGHT_NO_WEB_SERVER=1 npx playwright test e2e/integration
 */
import { test, expect } from "@playwright/test";
import { ensureAdminSession } from "../helpers/adminSession";

test.setTimeout(120_000);

test.describe("Admin API (integration)", () => {
  test("POST /api/admin/delivery-quote — 401 without session", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/delivery-quote", {
      data: { placeIn: "airport", placeOut: "airport" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toBeTruthy();
  });

  test("GET /api/admin/orders — 401 without session", async ({ request }) => {
    const res = await request.get("/api/admin/orders");
    expect(res.status()).toBe(401);
  });

  /**
   * Single login, then two API checks — avoids duplicate fragile UI steps
   * (cookie banner / MUI backdrop) and reduces flakiness.
   */
  test("with admin session: delivery-quote + orders list", async ({ page }) => {
    await ensureAdminSession(page);

    const quoteRes = await page.request.post("/api/admin/delivery-quote", {
      data: { placeIn: "airport", placeOut: "Thessaloniki Airport" },
    });

    expect(
      quoteRes.status(),
      `delivery-quote failed: ${await quoteRes.text().catch(() => "")}`
    ).toBe(200);

    const quoteBody = await quoteRes.json();
    expect(quoteBody.success).toBe(true);
    expect(quoteBody.data).toMatchObject({
      deliveryIn: expect.any(Number),
      deliveryOut: expect.any(Number),
      deliveryTotal: expect.any(Number),
      deliveryPricePerKm: expect.any(Number),
    });
    expect(quoteBody.data.deliveryTotal).toBe(
      quoteBody.data.deliveryIn + quoteBody.data.deliveryOut
    );

    const ordersRes = await page.request.get("/api/admin/orders");
    expect(
      ordersRes.status(),
      `admin orders failed: ${await ordersRes.text().catch(() => "")}`
    ).toBe(200);

    const ordersBody = await ordersRes.json();
    expect(ordersBody.success).toBe(true);
    expect(Array.isArray(ordersBody.data)).toBe(true);
    expect(typeof ordersBody.count).toBe("number");
  });
});
