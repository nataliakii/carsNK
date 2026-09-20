/**
 * E-signature provider abstraction.
 *
 * No paid e-sign service has been selected yet, so nothing is integrated.
 * Three modes exist behind one interface:
 *
 *   clickwrap      (default, implemented) — explicit checkbox + button inside
 *                  the authenticated partner area, backed by a full audit
 *                  trail: signer identity, authority confirmation, document
 *                  versions + checksums, rendered snapshot, UTC timestamp,
 *                  IP, user agent, authenticated user id.
 *
 *   manual         (implemented) — superadmin records a signature collected
 *                  outside the platform (scanned wet-ink copy, qualified
 *                  signature file). The storage reference of the evidence is
 *                  part of the audit trail.
 *
 *   external_esign (documented integration point, not wired) — DocuSign,
 *                  Dropbox Sign or Adobe Sign. See `externalEsignProvider.js`
 *                  for exactly which calls a future adapter must implement.
 *
 * Selection: PlatformSettings.legal.esignProvider, falling back to the
 * LEGAL_ESIGN_PROVIDER environment variable, then to clickwrap.
 */

import clickwrapProvider from "./clickwrapProvider";
import manualProvider from "./manualProvider";
import externalEsignProvider from "./externalEsignProvider";

export const ESIGN_MODE = Object.freeze({
  MANUAL: "manual",
  CLICKWRAP: "clickwrap",
  EXTERNAL: "external_esign",
});

export const ALL_ESIGN_MODES = Object.freeze(Object.values(ESIGN_MODE));

const PROVIDERS = {
  [ESIGN_MODE.CLICKWRAP]: clickwrapProvider,
  [ESIGN_MODE.MANUAL]: manualProvider,
  [ESIGN_MODE.EXTERNAL]: externalEsignProvider,
};

/**
 * @param {string} [preferred] value from platform settings
 * @returns {{ mode: string, provider: object }}
 */
export function resolveEsignProvider(preferred) {
  const candidate = String(
    preferred || process.env.LEGAL_ESIGN_PROVIDER || ESIGN_MODE.CLICKWRAP
  ).trim();
  const mode = ALL_ESIGN_MODES.includes(candidate)
    ? candidate
    : ESIGN_MODE.CLICKWRAP;
  return { mode, provider: PROVIDERS[mode] };
}

export { clickwrapProvider, manualProvider, externalEsignProvider };
