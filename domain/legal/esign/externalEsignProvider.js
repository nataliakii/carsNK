/**
 * External e-signature integration point — INTENTIONALLY NOT IMPLEMENTED.
 *
 * No provider has been chosen, so nothing is wired to a paid service. This
 * module documents the contract a future adapter (DocuSign, Dropbox Sign,
 * Adobe Sign, Signaturit for the Spanish market) must satisfy, and fails
 * loudly if selected before that work is done.
 *
 * To implement:
 *
 *  1. Add provider credentials as server-only env vars, e.g.
 *       ESIGN_PROVIDER_API_KEY, ESIGN_PROVIDER_ACCOUNT_ID,
 *       ESIGN_PROVIDER_WEBHOOK_SECRET
 *     Never expose them with a NEXT_PUBLIC_ prefix.
 *
 *  2. `validate(context)` — same checks as clickwrapProvider plus whatever the
 *     provider needs (e.g. a verified signer email).
 *
 *  3. `sign(context)` — create the envelope from
 *     `context.renderedDocuments` (title + sections already token-substituted,
 *     one entry per document in the package), returning:
 *       { ok, acceptanceMethod: "external_esign", esignProvider,
 *         esignEnvelopeId, esignStatus: "sent", redirectUrl }
 *     The acceptance record is written with esignStatus "sent" and is only
 *     treated as binding once the webhook reports completion.
 *
 *  4. Add a webhook route (suggested: app/api/legal/esign/webhook/route.js)
 *     that verifies the provider signature, looks the acceptance up by
 *     `esignEnvelopeId`, and updates `esignStatus` — the only field the
 *     immutability guard on PartnerAgreementAcceptance lets you change.
 *
 *  5. Keep the checksum of each document in the envelope metadata so the
 *     signed PDF can always be tied back to the exact stored version.
 */

const externalEsignProvider = {
  mode: "external_esign",
  requiresRedirect: true,
  implemented: false,

  validate() {
    return {
      ok: false,
      code: "provider_not_configured",
      message:
        "No external e-signature provider is integrated. Use clickwrap or manual, " +
        "or implement domain/legal/esign/externalEsignProvider.js first.",
    };
  },

  async sign() {
    throw new Error(
      "External e-signature provider is not implemented. See domain/legal/esign/externalEsignProvider.js."
    );
  },
};

export default externalEsignProvider;
