/**
 * Jest setup file
 * Runs before each test suite
 */

// Set timezone for consistent test results
process.env.TZ = "UTC";

// Pin the deployment profile so results never depend on the developer's local
// .env (which may point at the ES/rovaro.autos deployment). Tests that assert
// another country override these at the top of the file.
process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
process.env.NEXT_PUBLIC_SITE_URL = "https://carsnk.gr";

// Fail fast instead of hitting live Google APIs. The deployment key is
// referer-restricted and answers REQUEST_DENIED server-side, so Places /
// Distance Matrix must always be mocked in tests.
const realFetch = global.fetch;
if (typeof realFetch === "function") {
  global.fetch = function guardedFetch(input, init) {
    const url = String(
      typeof input === "string" || input instanceof URL ? input : input?.url || ""
    );
    if (/\b(maps|places)\.googleapis\.com\b/.test(url)) {
      throw new Error(
        `Blocked live Google API call in tests: ${url}. Mock the caller instead.`
      );
    }
    return realFetch(input, init);
  };
}

// Silence console.log in tests (optional)
// global.console.log = jest.fn();

