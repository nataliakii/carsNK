/**
 * Fail-closed database isolation for Jest / Playwright / local QA.
 *
 * Never silently fall back from a missing test DB to production.
 */

const PROD_HOST_HINTS = [
  "cluster0.gn8sza1.mongodb.net",
  "mongodb.net/Car",
];

/**
 * @param {string} uri
 * @param {string} dbName
 */
export function describeMongoTarget(uri, dbName) {
  const host = String(uri || "").match(/@([^/?]+)/)?.[1] || "";
  return { host, dbName: String(dbName || "") };
}

/**
 * True when URI/dbName clearly identifies an isolated test database.
 * @param {string} uri
 * @param {string} dbName
 */
export function isClearlyTestDatabase(uri, dbName) {
  const hay = `${String(uri || "")} ${String(dbName || "")}`.toLowerCase();
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
 * @param {string} uri
 * @param {string} dbName
 */
export function looksLikeProductionDatabase(uri, dbName) {
  const hay = `${String(uri || "")} ${String(dbName || "")}`;
  if (String(dbName || "") === "Car" && !isClearlyTestDatabase(uri, dbName)) {
    return true;
  }
  return PROD_HOST_HINTS.some((hint) => hay.includes(hint));
}

export function isAutomatedTestRuntime() {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "test") return true;
  if (process.env.JEST_WORKER_ID) return true;
  if (process.env.PLAYWRIGHT_TEST === "1") return true;
  if (process.env.PW_TEST === "1") return true;
  return false;
}

/**
 * Call before connecting when running under Jest/Playwright.
 * @param {{ uri?: string, dbName?: string }} opts
 */
export function assertTestDatabaseIsolation({
  uri = process.env.MONGODB_URI || "",
  dbName = process.env.MONGODB_DB_NAME || "Car",
} = {}) {
  if (!isAutomatedTestRuntime()) return { ok: true, skipped: true };

  if (!uri) {
    const err = new Error(
      "Refusing to start tests: MONGODB_URI is missing. Configure a dedicated test database; never fall back to production."
    );
    err.code = "test_db_missing";
    throw err;
  }

  if (!isClearlyTestDatabase(uri, dbName)) {
    const err = new Error(
      `Refusing to start tests: database does not clearly identify a test DB (dbName=${dbName}). Set MONGODB_URI/MONGODB_DB_NAME to an isolated test database.`
    );
    err.code = "test_db_not_isolated";
    throw err;
  }

  if (looksLikeProductionDatabase(uri, dbName) && !isClearlyTestDatabase(uri, dbName)) {
    const err = new Error(
      "Refusing to start tests: URI/dbName looks like production."
    );
    err.code = "test_db_production_blocked";
    throw err;
  }

  return { ok: true, dbName, ...describeMongoTarget(uri, dbName) };
}

/**
 * Browser/Playwright QA must not publish against production hosts.
 * @param {{ siteUrl?: string, allowPublish?: boolean }} opts
 */
export function assertBrowserQaPublishAllowed({
  siteUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
  allowPublish = false,
} = {}) {
  const url = String(siteUrl || "").toLowerCase();
  const isProdHost =
    url.includes("rovaro.es") ||
    url.includes("www.rovaro.es") ||
    url.includes("rovaro.autos");

  if (!allowPublish && isProdHost) {
    const err = new Error(
      "Browser QA must stop before real publication unless using an isolated QA database / non-production host."
    );
    err.code = "qa_publish_blocked_production";
    throw err;
  }

  if (allowPublish) {
    assertTestDatabaseIsolation({
      uri: process.env.MONGODB_URI || "",
      dbName: process.env.MONGODB_DB_NAME || "",
    });
  }

  return { ok: true };
}
