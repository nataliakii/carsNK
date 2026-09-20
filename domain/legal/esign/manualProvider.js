/**
 * Manual signature provider.
 *
 * Superadmin records a signature that was collected outside the platform.
 * A storage reference to the signed evidence is mandatory so the audit trail
 * still points at a concrete artefact.
 */

const manualProvider = {
  mode: "manual",
  requiresRedirect: false,

  validate(context = {}) {
    if (!String(context.signerName || "").trim()) {
      return { ok: false, code: "missing_signer", message: "Signer name is required" };
    }
    if (!String(context.signerRole || "").trim()) {
      return { ok: false, code: "missing_role", message: "Signer role is required" };
    }
    if (!context.confirmationOfAuthority) {
      return {
        ok: false,
        code: "authority_not_confirmed",
        message: "Signer authority must be confirmed",
      };
    }
    if (!String(context.evidenceStorageRef || "").trim()) {
      return {
        ok: false,
        code: "missing_evidence",
        message: "A storage reference to the signed document is required",
      };
    }
    return { ok: true };
  },

  async sign(context = {}) {
    return {
      ok: true,
      acceptanceMethod: "manual",
      esignProvider: "manual",
      esignEnvelopeId: String(context.evidenceStorageRef || ""),
      esignStatus: "completed",
    };
  },
};

export default manualProvider;
