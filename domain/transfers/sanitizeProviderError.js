const API_KEY_HINT =
  /AIza[0-9A-Za-z_-]{8,}|GOOGLE_MAPS_API_KEY|[?&]key=|Authorization:/i;

/**
 * Never return provider/API-key details to clients or logs.
 */
export function sanitizeProviderErrorMessage(message) {
  const raw = String(message || "").trim();
  if (!raw || API_KEY_HINT.test(raw)) {
    return "Distance provider unavailable";
  }
  if (/timeout|aborted|econnreset|enotfound|fetch failed/i.test(raw)) {
    return "Distance provider unavailable";
  }
  return raw.slice(0, 200);
}

export function redactSecretsForLog(value) {
  return String(value || "").replace(API_KEY_HINT, "[redacted]");
}
