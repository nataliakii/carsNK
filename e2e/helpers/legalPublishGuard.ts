/**
 * Playwright / browser QA guard: never publish against production hosts
 * unless an isolated QA DB is explicitly allowed.
 */

function isClearlyTestDatabase(uri: string, dbName: string): boolean {
  const hay = `${uri || ""} ${dbName || ""}`.toLowerCase();
  if (!hay.trim()) return false;
  if (/mongodb-memory-server|memory:mongo/.test(hay)) return true;
  if (/\b(test|tests|jest|playwright|cypress|ci[_-]?test|nk[_-]?test)\b/.test(hay)) {
    return true;
  }
  if (String(dbName || "").toLowerCase().endsWith("_test")) return true;
  if (String(dbName || "").toLowerCase().startsWith("test_")) return true;
  return false;
}

/**
 * Call before any admin legal publish step in e2e.
 */
export function guardLegalPublishInBrowserQa(opts: {
  baseURL?: string;
  allowPublish?: boolean;
} = {}): void {
  const baseURL =
    opts.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const url = String(baseURL || "").toLowerCase();
  const isProdHost =
    url.includes("rovaro.es") ||
    url.includes("www.rovaro.es") ||
    url.includes("rovaro.autos");

  if (!opts.allowPublish && isProdHost) {
    throw new Error(
      "Browser QA must stop before real publication unless using an isolated QA database / non-production host."
    );
  }

  if (opts.allowPublish) {
    const uri = process.env.MONGODB_URI || "";
    const dbName = process.env.MONGODB_DB_NAME || "";
    if (!isClearlyTestDatabase(uri, dbName)) {
      throw new Error(
        "ALLOW_QA_PUBLISH requires MONGODB_URI/MONGODB_DB_NAME to clearly identify a test DB."
      );
    }
  }
}
