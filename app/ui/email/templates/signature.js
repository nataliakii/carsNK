/**
 * Email signature — appended when API builds HTML from plain text.
 * Uses deployment brand + canonical URL (carsnk.gr or rovaro.autos).
 */

import { getBaseUrl, getCanonicalHost } from "@config/domain";
import { getActiveBrand, isGreeceSite } from "@config/brand";

function buildSignature() {
  const brand = getActiveBrand();
  const base = getBaseUrl();
  const host = getCanonicalHost();
  const line = isGreeceSite()
    ? "Car rental aggregator in Greece · Halkidiki &amp; Thessaloniki"
    : `${brand.tagline} · Spain`;
  const lineText = isGreeceSite()
    ? "Car rental aggregator in Greece · Halkidiki & Thessaloniki"
    : `${brand.tagline} · Spain`;
  const accent = brand.primary || "#E30052";

  return {
    html: `
<div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e0e0e0;">
  <div style="text-align: center; font-size: 13px; color: #616161; line-height: 1.8;">
    <div style="margin-bottom: 8px;">
      <strong style="color: #0A0A0A; font-size: 14px;">${brand.name} Support</strong>
    </div>
    <div style="color: #757575; margin-bottom: 12px;">
      ${line}
    </div>
    <div style="margin-top: 16px;">
      <a href="${base}" style="color: ${accent}; text-decoration: none; margin: 0 12px;">
        🌐 ${host}
      </a>
    </div>
  </div>
</div>`,
    text: `--

${brand.name} Support
${lineText}

Website: ${base}`,
  };
}

const sig = buildSignature();

export const EMAIL_SIGNATURE_HTML = sig.html;
export const EMAIL_SIGNATURE_TEXT = sig.text;
