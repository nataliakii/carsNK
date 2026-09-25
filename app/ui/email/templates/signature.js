/**
 * Email signature — appended when API builds HTML from plain text.
 * Uses deployment brand + canonical URL (carsnk.gr or rovaro.autos).
 */

import { getBaseUrl, getCanonicalHost } from "@config/domain";
import { getActiveBrand, isGreeceSite } from "@config/brand";
import { getEmailStyle } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import {
  getPublicLegalEntity,
  getBusinessAddressLine,
  getRegistrationLine,
} from "@config/legalEntity";

/**
 * Legal operator block for the Rovaro deployment.
 *
 * The customer sees the Rovaro brand; the legal footer identifies the actual
 * operator. Registration number and address appear only once configured —
 * an unconfirmed value is omitted rather than guessed.
 *
 * @returns {{ html: string, text: string }}
 */
function buildLegalFooter() {
  if (isGreeceSite()) return { html: "", text: "" };

  const s = getEmailStyle();
  const entity = getPublicLegalEntity();
  const registration = getRegistrationLine();
  const address = getBusinessAddressLine();

  const lines = [
    entity.platformBrand,
    `Operated by ${entity.ownerLegalName}, trading as ${entity.tradingName}`,
    registration,
    address,
    entity.legalEmail,
  ].filter(Boolean);

  return {
    html: `
    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid ${s.border}; font-size: 11px; color: ${s.footerMuted}; line-height: 1.7;">
      ${lines.map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br />")}
    </div>`,
    text: `\n\n${lines.join("\n")}`,
  };
}

function buildSignature() {
  const brand = getActiveBrand();
  const base = getBaseUrl();
  const host = getCanonicalHost();
  const legal = buildLegalFooter();
  const line = isGreeceSite()
    ? "Car rental aggregator in Greece · Halkidiki &amp; Thessaloniki"
    : `${brand.tagline} · Spain`;
  const lineText = isGreeceSite()
    ? "Car rental aggregator in Greece · Halkidiki & Thessaloniki"
    : `${brand.tagline} · Spain`;
  const s = getEmailStyle();

  return {
    html: `
<div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid ${s.border};">
  <div style="text-align: center; font-size: 13px; color: ${s.muted}; line-height: 1.8; font-family: ${s.fontSans};">
    <div style="margin-bottom: 8px;">
      <strong style="color: ${s.text}; font-size: 14px;">${brand.name} Support</strong>
    </div>
    <div style="color: ${s.muted}; margin-bottom: 12px;">
      ${line}
    </div>
    <div style="margin-top: 16px;">
      <a href="${base}" style="color: ${s.link}; text-decoration: none; margin: 0 12px;">
        🌐 ${host}
      </a>
    </div>
    ${legal.html}
  </div>
</div>`,
    text: `--

${brand.name} Support
${lineText}

Website: ${base}${legal.text}`,
  };
}

const sig = buildSignature();

export const EMAIL_SIGNATURE_HTML = sig.html;
export const EMAIL_SIGNATURE_TEXT = sig.text;
