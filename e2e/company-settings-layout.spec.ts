import { expect, test } from "@playwright/test";
import { ensureAdminSession } from "./helpers/adminSession";

const TABS = [
  "storefront",
  "people",
  "delivery",
  "pricing",
  "transfer",
  "vouchers",
] as const;

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
] as const;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(page: import("@playwright/test").Page, testId: string) {
  const el = page.getByTestId(testId);
  await expect(el).toBeVisible({ timeout: 30_000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`No bounding box for ${testId}`);
  return box as Box;
}

function assertSameEdges(a: Box, b: Box, label: string, tolerance = 2) {
  expect(Math.abs(a.x - b.x), `${label} left`).toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs(a.x + a.width - (b.x + b.width)),
    `${label} right`
  ).toBeLessThanOrEqual(tolerance);
}

test.describe("Company settings unified layout", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdminSession(page);
  });

  for (const vp of VIEWPORTS) {
    test(`shared edges across six tabs @ ${vp.name} (${vp.width})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/admin/company", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      await expect(page.getByTestId("company-settings-page")).toBeVisible({
        timeout: 45_000,
      });

      const baseline = {
        page: await boxOf(page, "company-settings-page"),
        header: await boxOf(page, "company-settings-header"),
        tabs: await boxOf(page, "company-settings-tabs"),
        content: await boxOf(page, "company-settings-tab-content"),
      };

      // Setup status may be absent when readiness is null; capture if present.
      const setup = page.getByTestId("company-settings-setup-status");
      const hasSetup = await setup.isVisible().catch(() => false);
      const setupBox = hasSetup ? await boxOf(page, "company-settings-setup-status") : null;

      assertSameEdges(baseline.header, baseline.page, "header vs page");
      assertSameEdges(baseline.tabs, baseline.page, "tabs vs page");
      assertSameEdges(baseline.content, baseline.page, "content vs page");
      if (setupBox) {
        assertSameEdges(setupBox, baseline.page, "setup vs page");
      }

      // No horizontal overflow of the shell.
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 1);

      for (const tab of TABS) {
        if (tab === "storefront") continue;
        await page.getByTestId(`company-tab-${tab}`).click();
        await expect(
          page.getByTestId("company-settings-tab-content")
        ).toBeVisible();

        const next = {
          page: await boxOf(page, "company-settings-page"),
          header: await boxOf(page, "company-settings-header"),
          tabs: await boxOf(page, "company-settings-tabs"),
          content: await boxOf(page, "company-settings-tab-content"),
        };

        assertSameEdges(next.page, baseline.page, `${tab} page`);
        assertSameEdges(next.header, baseline.header, `${tab} header`);
        assertSameEdges(next.tabs, baseline.tabs, `${tab} tabs`);
        assertSameEdges(next.content, baseline.content, `${tab} content`);

        if (hasSetup) {
          const nextSetup = await boxOf(page, "company-settings-setup-status");
          assertSameEdges(nextSetup, setupBox!, `${tab} setup`);
        }

        // Capture a screenshot for visual QA artefacts.
        await page.screenshot({
          path: `test-results/company-layout-${vp.name}-${tab}.png`,
          fullPage: false,
        });
      }
    });
  }
});
