/**
 * Email brand tokens. Mail clients cannot read the MUI theme at send time,
 * so this module mirrors config/brand.js (and the matching neutrals from theme.js).
 * Templates read these tokens — they do not set their own hex colors.
 */

import { CARSNK_BRAND, ROVARO_BRAND, getActiveBrand } from "@config/brand";
import { absoluteUrl } from "@config/domain";

const FONT_SANS =
  "Nunito, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Neutrals copied from theme.js `palette.neutral` for the active brand.
 * theme.js is a client module, so email rendering cannot import it.
 */
const NEUTRALS = {
  rovaro: {
    page: "#F3F3F3",
    details: "#FAFAFA",
    border: "#E5E5E5",
    footerMuted: "#A3A3A3",
  },
  carsnk: {
    page: "#F4F8FA",
    details: "#F4F8FA",
    border: "#D5E0E8",
    footerMuted: "#8FA3B3",
  },
};

/** Measured from the approved wordmark files used by SiteLogo. */
const LOGO_ASPECT = {
  rovaro: { w: 788, h: 207 },
  carsnk: { w: 1127, h: 286 },
};

const LOGO_HEIGHT = 40;

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function channelToHex(value) {
  return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

/** Mix `color` over `base` by `amount` (0–1). Same idea as theme alpha() on white. */
function mixOver(color, base, amount) {
  const [r1, g1, b1] = hexToRgb(color);
  const [r2, g2, b2] = hexToRgb(base);
  return `#${channelToHex(r1 * amount + r2 * (1 - amount))}${channelToHex(
    g1 * amount + g2 * (1 - amount)
  )}${channelToHex(b1 * amount + b2 * (1 - amount))}`;
}

/**
 * @param {"rovaro" | "carsnk"} [brandId]
 *   Omit to follow the deployment country. Pass "rovaro" for templates that
 *   are Rovaro-only even when the process default country is Greece.
 */
export function getEmailStyle(brandId) {
  const brand =
    brandId === "rovaro"
      ? ROVARO_BRAND
      : brandId === "carsnk"
        ? CARSNK_BRAND
        : getActiveBrand();
  const rovaro = brand.id === "rovaro";
  const neutrals = rovaro ? NEUTRALS.rovaro : NEUTRALS.carsnk;
  const white = brand.white;
  const primary = brand.primary;
  const aspect = rovaro ? LOGO_ASPECT.rovaro : LOGO_ASPECT.carsnk;
  const logoWidth = Math.round((LOGO_HEIGHT * aspect.w) / aspect.h);
  const logoPath = brand.logos.wordmarkOnDark;

  return {
    bgPage: neutrals.page,
    bgCard: white,
    bgDetailsCard: neutrals.details,
    bgPriceBlock: mixOver(primary, white, 0.08),
    text: brand.black,
    muted: brand.gray,
    accent: primary,
    border: neutrals.border,
    headerBg: brand.secondary,
    headerText: white,
    /**
     * Legacy key. Value is the brand header (black on Rovaro, navy on CarsNK),
     * not the old teal bar.
     */
    headerTeal: brand.secondary,
    ctaBg: primary,
    ctaText: white,
    link: primary,
    /** theme.js palette.status.error */
    danger: "#E53935",
    noticeBg: mixOver(primary, white, 0.08),
    noticeBorder: mixOver(primary, white, 0.28),
    noticeEdge: primary,
    accentBar: primary,
    footerMuted: neutrals.footerMuted,
    fontFamily:
      "Georgia, 'Times New Roman', serif",
    fontSans: FONT_SANS,
    brandName: brand.name,
    logo: {
      src: absoluteUrl(logoPath),
      width: logoWidth,
      height: LOGO_HEIGHT,
      alt: brand.displayName || brand.name,
    },
  };
}

export const EMAIL_STYLE = new Proxy(
  {},
  {
    get(_target, prop) {
      return getEmailStyle()[prop];
    },
  }
);

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
    `<strong style="color:${EMAIL_STYLE.accent};">${escapeHtml(inner)}</strong>`
  );
}

export function renderEmailLogoHtml(style = getEmailStyle()) {
  const logo = style.logo;
  if (!logo?.src) return "";
  return `<img src="${escapeHtml(logo.src)}" width="${logo.width}" height="${logo.height}" alt="${escapeHtml(logo.alt)}" border="0" style="display:block;margin:0 auto 16px auto;border:0;outline:none;text-decoration:none;height:${logo.height}px;width:${logo.width}px;" />`;
}

/**
 * Shared header: dark brand bar, existing wordmark, title, magenta/cyan accent rule.
 * Returns two table rows. Place them inside the email card table.
 */
export function renderEmailHeaderRow({ title = "", subtitle = "", style } = {}) {
  const s = style || getEmailStyle();
  const titleHtml = title
    ? `<h1 style="margin:0;color:${s.headerText};font-size:22px;font-weight:600;letter-spacing:0.2px;line-height:1.35;font-family:${s.fontSans};">${escapeHtml(title)}</h1>`
    : "";
  const subtitleHtml = subtitle
    ? `<div style="margin-top:8px;font-size:13px;line-height:1.45;color:${s.headerText};font-family:${s.fontSans};">${escapeHtml(subtitle)}</div>`
    : "";
  return `<tr>
            <td style="background-color:${s.headerBg};padding:28px 36px 22px 36px;text-align:center;">
              ${renderEmailLogoHtml(s)}
              ${titleHtml}
              ${subtitleHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${s.accentBar};padding:0;height:4px;line-height:4px;font-size:0;">&nbsp;</td>
          </tr>`;
}

export function renderNoticeBlock(innerHtml, margin = "20px 0 0 0") {
  const s = getEmailStyle();
  return `<div style="margin:${margin};padding:16px 18px;background-color:${s.noticeBg};border:1px solid ${s.noticeBorder};border-left:4px solid ${s.noticeEdge};">
                <p style="margin:0;color:${s.text};line-height:1.55;font-size:14px;font-family:${s.fontSans};">${innerHtml}</p>
              </div>`;
}

export function renderEmailButton(href, label, style = getEmailStyle()) {
  const s = style;
  return `<a href="${escapeHtml(href)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:14px 28px;background-color:${s.ctaBg};color:${s.ctaText};text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;font-family:${s.fontSans};">${escapeHtml(label)}</a>`;
}
