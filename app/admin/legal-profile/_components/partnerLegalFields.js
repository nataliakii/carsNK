import {
  REQUIRED_PROFILE_FIELDS,
  REQUIRED_PROFILE_DOCUMENTS,
} from "@/domain/legal/partnerVerification";
import { PARTNER_DOCUMENT_KIND } from "@/domain/legal/partnerDocuments";

/**
 * Layout of the partner legal profile form.
 *
 * Which fields are mandatory is not decided here — `REQUIRED_PROFILE_FIELDS`
 * on the server owns that, and `required` below is derived from it so the
 * asterisks can never drift away from what actually blocks verification.
 */
const field = (key, extra = {}) => ({
  key,
  required: REQUIRED_PROFILE_FIELDS.includes(key),
  ...extra,
});

export const ENTITY_TYPE_OPTIONS = ["sl", "sa", "autonomo", "other"];

export const PARTNER_PROFILE_SECTIONS = [
  {
    id: "identity",
    fields: [
      field("legalName"),
      field("tradingName"),
      field("entityType", { options: ENTITY_TYPE_OPTIONS }),
      field("countryOfRegistration", { maxLength: 2, uppercase: true }),
      field("registrationNumber"),
      field("nifCif"),
      field("vatNumber"),
    ],
  },
  {
    id: "addresses",
    fields: [
      field("registeredAddress", { multiline: true }),
      field("businessAddress", { multiline: true }),
    ],
  },
  {
    id: "signatory",
    fields: [
      field("signatoryName"),
      field("signatoryRole"),
      field("signatoryAuthorityBasis", { multiline: true, fullWidth: true }),
    ],
    confirmations: ["signatoryAuthorityConfirmed"],
  },
  {
    id: "contact",
    fields: [
      field("businessEmail", { type: "email" }),
      field("businessPhone"),
      field("emergencyPhone"),
    ],
  },
  {
    id: "payout",
    fields: [field("payoutAccountReference", { fullWidth: true })],
  },
  {
    id: "insurance",
    fields: [
      field("insuranceProvider"),
      field("insurancePolicyReference"),
      field("insuranceValidUntil", { type: "date" }),
    ],
  },
  {
    id: "vehicles",
    fields: [],
    confirmations: ["vehicleAuthorityConfirmed"],
  },
];

/** Every text field the form writes, in the order it is rendered. */
export const PARTNER_PROFILE_TEXT_FIELDS = PARTNER_PROFILE_SECTIONS.flatMap(
  (section) => section.fields.map((f) => f.key)
);

export const PARTNER_PROFILE_CONFIRMATIONS = PARTNER_PROFILE_SECTIONS.flatMap(
  (section) => section.confirmations || []
);

/**
 * Evidence rows. Required kinds come from the server list so the form and
 * the verification check stay in step; the rest are conditional.
 */
export const PARTNER_DOCUMENT_ROWS = [
  PARTNER_DOCUMENT_KIND.COMPANY_REGISTRATION,
  PARTNER_DOCUMENT_KIND.INSURANCE_CERTIFICATE,
  PARTNER_DOCUMENT_KIND.VEHICLE_AUTHORITY,
  PARTNER_DOCUMENT_KIND.TAX_IDENTIFICATION,
  PARTNER_DOCUMENT_KIND.VAT_CERTIFICATE,
  PARTNER_DOCUMENT_KIND.LICENCE_PERMIT,
  PARTNER_DOCUMENT_KIND.PAYOUT_BANK_PROOF,
  PARTNER_DOCUMENT_KIND.SIGNATORY_AUTHORITY,
].map((kind) => ({
  kind,
  required: REQUIRED_PROFILE_DOCUMENTS.includes(kind),
}));
