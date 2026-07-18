import { expect, type Page } from "@playwright/test";

const ADMIN_EMAIL =
  process.env.PLAYWRIGHT_ADMIN_EMAIL?.trim() || "admin@gmail.com";
const ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD?.trim() || "11111111";

/**
 * Prefer skipping the GDPR banner via localStorage (see CookieConsentContext).
 * Fallback: dismiss if it still mounts (hydration race).
 */
export async function acceptCookieBannerIfPresent(page: Page): Promise<void> {
  const banner = page.getByTestId("cookie-banner");
  const isVisible = await banner
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  if (!isVisible) return;

  await page.getByTestId("cookie-accept-btn").click({ force: true });
  await expect(banner).not.toBeVisible({ timeout: 15_000 });
}

async function adminOrdersOk(page: Page): Promise<boolean> {
  const res = await page.request.get("/api/admin/orders");
  return res.status() === 200;
}

/**
 * Ensures NextAuth cookies allow admin APIs (login via /login if needed).
 * Success = GET /api/admin/orders returns 200 (no dependency on navbar i18n).
 */
export async function ensureAdminSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("cookie-consent", "accepted");
    } catch {
      /* ignore */
    }
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto("/login", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      break;
    } catch {
      if (attempt === 2) throw new Error("page.goto(/login) failed after retries");
      await page.waitForTimeout(500);
    }
  }

  await acceptCookieBannerIfPresent(page);

  if (await adminOrdersOk(page)) return;

  await page
    .getByPlaceholder("email")
    .waitFor({ state: "visible", timeout: 20_000 });

  await page.getByPlaceholder("email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^login$/i }).click();

  await page.waitForURL((url) => url.pathname.startsWith("/admin"), {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });

  if (!(await adminOrdersOk(page))) {
    const res = await page.request.get("/api/admin/orders");
    const text = await res.text().catch(() => "");
    throw new Error(
      `Admin session not established: GET /api/admin/orders → ${res.status()} ${text.slice(0, 200)}`
    );
  }
}
