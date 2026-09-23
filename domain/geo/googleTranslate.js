/**
 * Google Cloud Translation API v2 (REST).
 *
 * Used to turn a company's English rental rules into every UI locale so the
 * customer can read them in the language they booked in. The key is server-side
 * only — never NEXT_PUBLIC_.
 *
 * GOOGLE_TRANSLATE_API_KEY wins when set; otherwise GOOGLE_MAPS_API_KEY is
 * reused if Cloud Translation API is enabled on that GCP project.
 */

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_Q_CHARS = 30_000;

export function getTranslateApiKey() {
  return String(
    process.env.GOOGLE_TRANSLATE_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ""
  ).trim();
}

export function isGoogleTranslateConfigured() {
  return Boolean(getTranslateApiKey());
}

/**
 * Google's language codes match our UI codes except Norwegian (`no`).
 * @param {string} locale
 */
export function toGoogleTranslateTarget(locale) {
  const code = String(locale || "")
    .toLowerCase()
    .split("-")[0]
    .trim();
  if (code === "nb" || code === "nn") return "no";
  return code;
}

function splitForTranslate(text) {
  const src = String(text || "");
  if (src.length <= MAX_Q_CHARS) return [src];
  const chunks = [];
  let rest = src;
  while (rest.length > MAX_Q_CHARS) {
    const window = rest.slice(0, MAX_Q_CHARS);
    const breakAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf(" ")
    );
    const cut = breakAt > MAX_Q_CHARS / 2 ? breakAt : MAX_Q_CHARS;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function postTranslate({ q, source, target, key, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${TRANSLATE_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q,
        source,
        target,
        format: "text",
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data?.error?.message ||
        data?.error?.status ||
        `Translate HTTP ${res.status}`;
      throw new Error(message);
    }
    const translations = data?.data?.translations;
    if (!Array.isArray(translations) || translations.length === 0) {
      throw new Error("Translate returned no text");
    }
    return translations.map((row) => String(row?.translatedText || ""));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translate one string into one target language.
 * @returns {Promise<string>}
 */
export async function translateText({
  text,
  target,
  source = "en",
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const key = getTranslateApiKey();
  if (!key) {
    throw new Error("Google Translate is not configured");
  }
  const googleTarget = toGoogleTranslateTarget(target);
  const googleSource = toGoogleTranslateTarget(source) || "en";
  if (!googleTarget) {
    throw new Error("Translate target language is missing");
  }
  if (googleTarget === googleSource) return String(text || "");

  const chunks = splitForTranslate(text);
  const out = [];
  for (const chunk of chunks) {
    const [piece] = await postTranslate({
      q: chunk,
      source: googleSource,
      target: googleTarget,
      key,
      timeoutMs,
    });
    out.push(piece);
  }
  return out.join("");
}

/**
 * Translate one English source into many locales. Failures are collected
 * rather than aborting the whole batch, so a partner can retry missing langs.
 *
 * @param {{ text: string, targets: string[], source?: string, concurrency?: number }} opts
 * @returns {Promise<{ translations: Record<string, string>, failed: Array<{ language: string, message: string }> }>}
 */
export async function translateToLocales({
  text,
  targets,
  source = "en",
  concurrency = 4,
} = {}) {
  const translations = {};
  const failed = [];
  const list = Array.isArray(targets)
    ? [...new Set(targets.map((code) => String(code || "").trim().toLowerCase()).filter(Boolean))]
    : [];
  const sourceLang = String(source || "en").toLowerCase();

  let index = 0;
  async function worker() {
    while (index < list.length) {
      const language = list[index];
      index += 1;
      if (language === sourceLang) continue;
      try {
        translations[language] = await translateText({
          text,
          target: language,
          source: sourceLang,
        });
      } catch (err) {
        failed.push({
          language,
          message: err?.message || "translate failed",
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, list.length || 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return { translations, failed };
}
