import { defineConfig, devices } from "@playwright/test";

/**
 * E2E / integration tests against the Next app.
 *
 * - Default URL matches `npm run dev` (port 3026).
 * - Override: PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test
 * - Admin login: PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 * - Skip auto web server: PLAYWRIGHT_NO_WEB_SERVER=1 (start dev yourself)
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://127.0.0.1:3026";

const skipWebServer = process.env.PLAYWRIGHT_NO_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
