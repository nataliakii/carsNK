/**
 * Natali Cars email theme — colors and typography for email templates.
 * Single source of truth for brand-accent and layout styles (inline, email-client safe).
 */

export const EMAIL_STYLE = {
  bgPage: "#f7f7f7",
  bgCard: "#ffffff",
  bgDetailsCard: "#fafafa",
  bgPriceBlock: "#f0f2f5",
  text: "#1a1a1a",
  muted: "#6b6b6b",
  accent: "#2c3e50",
  border: "#e8e8e8",
  /** Голубая заставка (шапка письма) — teal */
  headerTeal: "#008989",
  headerText: "#ffffff",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

export function escapeHtml(s) {
  if (s == null || s === "") return "";
  const str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert **text** to <strong>text</strong> for HTML; inner content is escaped.
 */
export function strongFromMarkdown(s) {
  if (s == null || s === "") return "";
  return String(s).replace(/\*\*([^*]+)\*\*/g, (_, inner) =>
    "<strong style=\"color:" + EMAIL_STYLE.accent + ";\">" + escapeHtml(inner) + "</strong>"
  );
}
