/**
 * E2E: Long-press interaction in Admin calendar
 * npx playwright test e2e/long-press.spec.ts
 *
 * This test verifies observable behavior only:
 * - Short click opens the order edit modal (and does NOT enter move mode)
 * - Long press enters "move order" mode (and does NOT open the edit modal)
 * - Early release (including release outside target) cancels long press with no delayed side-effects
 * - Repeating long press does not cause duplicated actions (fires once per interaction)
 *
 * IMPORTANT:
 * - We do NOT depend on internal timers/state names.
 * - We use conservative timing margins in the test to separate short vs long press.
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "11111111";

// Observable UI effects (strings are part of current UI)
const LONG_PRESS_HINT_SUBSTRING = "Длинное нажатие для режима перемещения заказа";
const MOVE_MODE_EXIT_TITLE = "Нажмите для выхода из режима перемещения";
const MOVE_MODE_SNACKBAR_TEXT =
  "Выберите другой автомобиль для перемещения заказа. Доступные автомобили выделены желтым цветом";
const EMPTY_CELL_CREATE_TITLE = "Нажмите для создания нового заказа";

async function acceptCookieBannerIfPresent(page: Page) {
  const banner = page.getByTestId("cookie-banner");
  // Banner can appear slightly after first paint (localStorage hydration).
  // Wait briefly; if it doesn't show up, continue.
  const isVisible = await banner
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!isVisible) return;

  await page.getByTestId("cookie-accept-btn").click();
  await expect(banner).not.toBeVisible();
}

async function createQuickOrderFromFirstEmptyCell(page: Page) {
  // Click an empty future cell to open AddOrder modal, then submit minimal required fields.
  const emptyCell = page.locator(`[title="${EMPTY_CELL_CREATE_TITLE}"]`).first();
  await expect(
    emptyCell,
    `No empty calendar cell found with title "${EMPTY_CELL_CREATE_TITLE}".`
  ).toBeVisible({ timeout: 30_000 });

  await emptyCell.click();

  // Add order modal heading: i18n ("Add order" by default locale)
  await expect(page.getByRole("heading", { name: /add order/i }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Fill required fields
  await page.getByLabel(/name/i).fill(`E2E Test ${Date.now()}`);
  await page.getByLabel(/phone/i).fill("000000000");

  const completeBtn = page.getByRole("button", { name: /complete/i }).first();
  await expect(completeBtn).toBeEnabled({ timeout: 30_000 });

  // The UI may briefly reject submission while async price calculation is running.
  // We retry a few times if we see the observable "wait for price calculation" message.
  const waitPriceMsg = page.getByText(/Дождитесь расчёта стоимости|wait for price/i);
  const addOrderHeading = page.getByRole("heading", { name: /add order/i });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await completeBtn.click();

    // Success path: modal closes (auto close after success).
    const closed = await addOrderHeading
      .waitFor({ state: "detached", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (closed) return;

    // If blocked by price calc, wait a bit and retry.
    if (await waitPriceMsg.isVisible().catch(() => false)) {
      await page.waitForTimeout(1_000);
      continue;
    }
  }

  throw new Error("Failed to create order via AddOrder modal (modal did not close).");
}

async function loginIfNeeded(page: Page) {
  // NOTE: admin pages can keep background requests running (polling/refetch),
  // so `networkidle` may never be reached. Use DOM readiness + explicit UI waits.
  await page.goto("/admin/orders-calendar", { waitUntil: "domcontentloaded" });

  const loginFormVisible =
    page.url().includes("/login") ||
    (await page.getByPlaceholder("email").isVisible().catch(() => false));

  if (loginFormVisible) {
    // Login page uses placeholders "email" and "password".
    await page.getByPlaceholder("email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("password").fill(ADMIN_PASSWORD);
    
    // Login.js uses signIn() with redirect: false, then window.location.href = "/admin"
    // This causes a full page reload. Wait for navigation after click.
    await page.getByRole("button", { name: /^login$/i }).click();
    
    // Wait for redirect to admin page (Login.js redirects to /admin via window.location.href)
    // Use waitForURL with a longer timeout since window.location.href causes full reload
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { 
      timeout: 60_000,
      waitUntil: "domcontentloaded"
    }).catch(async (error) => {
      // If navigation timeout, check current state for debugging
      const currentUrl = page.url();
      const pageContent = await page.content().catch(() => "could not get content");
      
      // Check for login error message
      const errorElement = await page.locator('h2').filter({ hasText: /error|denied|invalid/i }).first().isVisible().catch(() => false);
      if (errorElement) {
        const errorText = await page.locator('h2').filter({ hasText: /error|denied|invalid/i }).first().textContent().catch(() => "unknown");
        throw new Error(`Login failed with error: ${errorText}. Current URL: ${currentUrl}`);
      }
      
      if (currentUrl.includes("/login")) {
        throw new Error(
          `Login did not redirect. Still on login page after 60s. ` +
          `URL: ${currentUrl}. ` +
          `Check if login credentials are correct (${ADMIN_EMAIL}).`
        );
      }
      
      // Re-throw original error if we can't diagnose
      throw error;
    });

    // Confirm we are authenticated - wait for Logout button to appear
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible({
      timeout: 60_000,
    });

    // Ensure page is fully loaded after redirect
    await page.waitForLoadState("domcontentloaded");
    
    // Navigate to the calendar page
    await page.goto("/admin/orders-calendar", { waitUntil: "domcontentloaded" });
    
    // Wait for URL to be correct
    await page.waitForURL("**/admin/orders-calendar", { timeout: 10_000 });
  }

  // CalendarSection is lazy-loaded via dynamic() import, so it may take time to appear.
  // Wait for the calendar container to be rendered using waitForFunction.
  try {
    await page.waitForFunction(
      () => {
        const calendarRoot = document.querySelector(".bigcalendar-root");
        return calendarRoot !== null;
      },
      { timeout: 60_000 }
    );
  } catch (error) {
    // Fallback: check if page has any table (calendar uses MUI Table)
    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    if (!hasTable) {
      const pageTitle = await page.title().catch(() => "unknown");
      throw new Error(
        `Calendar did not load: .bigcalendar-root not found and no table found. ` +
        `Current URL: ${page.url()}. ` +
        `Page title: ${pageTitle}. ` +
        "Check if CalendarSection lazy-loading completed."
      );
    }
  }

  // Ensure calendar is visible and rendered.
  await expect(page.locator(".bigcalendar-root")).toBeVisible({ timeout: 60_000 });
  
  // Also wait for at least one car row to be visible (ensures data loaded).
  await expect(page.getByRole("row").filter({ hasText: /[A-Za-z0-9]/ }).first()).toBeVisible({
    timeout: 60_000,
  });
}

async function getOrderCellForLongPress(page: Page) {
  // Calendar order cells expose a helpful title with long-press instruction.
  const cell = page
    .locator(`[title*="${LONG_PRESS_HINT_SUBSTRING}"]`)
    .first();

  await expect(cell, `No calendar order cell found with title containing "${LONG_PRESS_HINT_SUBSTRING}". Make sure there is at least one order visible in the admin calendar.`).toBeVisible({
    timeout: 30_000,
  });

  return cell;
}

async function longPress(locator: ReturnType<Page["locator"]>, page: Page, holdMs: number) {
  const box = await locator.boundingBox();
  expect(box, "Expected target to have a bounding box").toBeTruthy();
  const x = (box!.x + box!.width / 2) | 0;
  const y = (box!.y + box!.height / 2) | 0;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

async function longPressAnyEligibleOrderCell(page: Page, holdMs: number) {
  // Some months may contain only completed/edge-case orders where long-press is intentionally disabled.
  // We try a few months forward until we find a cell that produces the observable long-press UI effect.
  for (let monthAttempt = 0; monthAttempt < 6; monthAttempt += 1) {
    const candidates = page.locator(`[title*="${LONG_PRESS_HINT_SUBSTRING}"]`);
    const count = await candidates.count();

    // Probe a few visible candidates and pick the first one that produces the snackbar.
    const limit = Math.min(count, 12);
    for (let i = 0; i < limit; i += 1) {
      const cell = candidates.nth(i);
      if (!(await cell.isVisible().catch(() => false))) continue;

      await longPress(cell, page, holdMs);

      const snackbarVisible = await page
        .getByText(MOVE_MODE_SNACKBAR_TEXT)
        .isVisible()
        .catch(() => false);

      if (snackbarVisible) return cell;

      // If it didn't trigger, make sure we are not stuck in any mode.
      await page.keyboard.press("Escape").catch(() => {});
    }

    // No eligible cell found in this month → go to next month and retry.
    const nextMonthBtn = page.getByRole("button", { name: "▶" }).first();
    const canGoNext = await nextMonthBtn.isVisible().catch(() => false);
    if (!canGoNext) break;
    await nextMonthBtn.click();
    // Give the table a moment to re-render for the new month.
    await page.waitForTimeout(500);
  }

  // As a last resort (in case dataset has no eligible orders), create a fresh order via UI,
  // then try once more on the current month view.
  await createQuickOrderFromFirstEmptyCell(page);
  const seededCandidates = page.locator(`[title*="${LONG_PRESS_HINT_SUBSTRING}"]`);
  const seededCount = await seededCandidates.count();
  for (let i = 0; i < Math.min(seededCount, 12); i += 1) {
    const cell = seededCandidates.nth(i);
    if (!(await cell.isVisible().catch(() => false))) continue;
    await longPress(cell, page, holdMs);
    if (await page.getByText(MOVE_MODE_SNACKBAR_TEXT).isVisible().catch(() => false)) return cell;
    await page.keyboard.press("Escape").catch(() => {});
  }

  throw new Error(
    `Could not find an order cell where long-press triggers move mode (snackbar not observed). ` +
      `If your dataset has no active (non-completed) orders in the next few months, the test cannot verify long-press behavior.`
  );
}

test.describe("Long press behavior (admin calendar)", () => {
  // Admin calendar can be heavy; give each test more room than the default 30s.
  test.describe.configure({ timeout: 90_000 });
  // These tests mutate shared UI state (auth/session, move mode); run serially for stability.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    // Keep tests isolated from persisted client state.
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      // Prevent cookie banner from blocking interactions in admin flows.
      window.localStorage.setItem("cookie-consent", "accepted");
    });
  });

  test("short click does not trigger long-press action", async ({ page }) => {
    await loginIfNeeded(page);

    const orderCell = await getOrderCellForLongPress(page);

    // Short click: quick press+release (Playwright click) should open edit modal, not move mode.
    await orderCell.click();

    // Observable short-click result: Edit order modal opens.
    await expect(page.getByRole("heading", { name: /Edit order/i }).first()).toBeVisible();

    // Long-press UI indicators must NOT appear.
    await expect(page.locator(`[title="${MOVE_MODE_EXIT_TITLE}"]`)).toHaveCount(0);
    await expect(page.getByText(MOVE_MODE_SNACKBAR_TEXT)).toHaveCount(0);

    // Close modal (Escape is the most robust cross-locale action here).
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: /Edit order/i })).toHaveCount(0);
  });

  test("long press triggers long-press action", async ({ page }) => {
    await loginIfNeeded(page);

    // Long press: hold well above unknown threshold.
    // We use a conservative 900ms to clearly exceed typical long-press thresholds.
    await longPressAnyEligibleOrderCell(page, 900);

    // Observable long-press result: move mode becomes active.
    await expect(page.getByText(MOVE_MODE_SNACKBAR_TEXT)).toBeVisible();

    // Short-click modal must NOT open as a side effect of long press.
    await expect(page.getByRole("heading", { name: /Edit order/i })).toHaveCount(0);

    // Clean up: exit move mode via ESC (supported by hook).
    await page.keyboard.press("Escape");
    await expect(page.locator(`[title="${MOVE_MODE_EXIT_TITLE}"]`)).toHaveCount(0);
  });

  test("early release (including release outside target) cancels long-press with no delayed side-effects", async ({ page }) => {
    await loginIfNeeded(page);

    const orderCell = await getOrderCellForLongPress(page);

    // Press down on the cell, move away, and release quickly BEFORE long-press threshold.
    const box = await orderCell.boundingBox();
    expect(box, "Expected target to have a bounding box").toBeTruthy();
    const x = (box!.x + box!.width / 2) | 0;
    const y = (box!.y + box!.height / 2) | 0;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(50); // clearly below any long-press threshold

    // Move pointer away and release outside the target.
    await page.mouse.move(5, 5);
    await page.mouse.up();

    // Wait long enough that a delayed long-press would have fired if timer wasn't canceled.
    await page.waitForTimeout(900);

    // No move mode.
    await expect(page.locator(`[title="${MOVE_MODE_EXIT_TITLE}"]`)).toHaveCount(0);
    await expect(page.getByText(MOVE_MODE_SNACKBAR_TEXT)).toHaveCount(0);

    // No modal should open as a side-effect of this canceled gesture.
    await expect(page.getByRole("heading", { name: /Edit order/i })).toHaveCount(0);
  });

  test("long-press fires only once per interaction even when repeated", async ({ page }) => {
    await loginIfNeeded(page);

    // First, find a cell where long-press actually triggers (some edge-case cells may not).
    const orderCell = await longPressAnyEligibleOrderCell(page, 900);
    // Exit move mode so we can start the loop from a clean state.
    await page.keyboard.press("Escape");

    for (let i = 0; i < 3; i += 1) {
      await longPress(orderCell, page, 900);

      // Move mode should activate (exactly once per interaction).
      await expect(page.getByText(MOVE_MODE_SNACKBAR_TEXT)).toBeVisible();

      // Extra wait to catch "zombie timers" firing again after activation.
      await page.waitForTimeout(500);
      // We assert the snackbar still exists (no duplicated/delayed UI action expected).
      await expect(page.getByText(MOVE_MODE_SNACKBAR_TEXT)).toBeVisible();

      // Exit move mode and ensure we can re-enter cleanly.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: /Edit order/i })).toHaveCount(0);
    }
  });
});

