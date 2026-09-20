/**
 * Clickwrap signature provider.
 *
 * The partner reviews the full rendered agreement package in the
 * authenticated partner area, confirms the signer's authority, ticks an
 * explicit acceptance checkbox and submits. Acceptance is only recorded when
 * every element of the audit trail is present.
 */

const REQUIRED_CONTEXT = [
  "authenticatedUserId",
  "signerName",
  "signerRole",
  "signerEmail",
];

const clickwrapProvider = {
  mode: "clickwrap",
  /** Signature happens inline; no external round trip. */
  requiresRedirect: false,

  /**
   * @param {{
   *   authenticatedUserId?: string,
   *   signerName?: string,
   *   signerRole?: string,
   *   signerEmail?: string,
   *   confirmationOfAuthority?: boolean,
   *   acceptedCheckbox?: boolean,
   *   ipAddress?: string,
   *   userAgent?: string,
   * }} context
   */
  validate(context = {}) {
    const missing = REQUIRED_CONTEXT.filter(
      (key) => !String(context[key] || "").trim()
    );
    if (missing.length) {
      return {
        ok: false,
        code: "missing_signer_details",
        message: `Missing: ${missing.join(", ")}`,
      };
    }
    if (!context.confirmationOfAuthority) {
      return {
        ok: false,
        code: "authority_not_confirmed",
        message: "The signer must confirm they are authorised to bind the partner",
      };
    }
    if (!context.acceptedCheckbox) {
      return {
        ok: false,
        code: "acceptance_not_ticked",
        message: "The acceptance checkbox must be ticked",
      };
    }
    if (!String(context.ipAddress || "").trim()) {
      return {
        ok: false,
        code: "missing_audit_context",
        message: "Cannot record a clickwrap acceptance without the client IP",
      };
    }
    return { ok: true };
  },

  /**
   * Nothing to send anywhere — the acceptance record itself is the evidence.
   */
  async sign() {
    return {
      ok: true,
      acceptanceMethod: "clickwrap",
      esignProvider: "rovaro-clickwrap",
      esignEnvelopeId: "",
      esignStatus: "completed",
    };
  },
};

export default clickwrapProvider;
