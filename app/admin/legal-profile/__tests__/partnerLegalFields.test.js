import {
  REQUIRED_PROFILE_CONFIRMATIONS,
  REQUIRED_PROFILE_DOCUMENTS,
  REQUIRED_PROFILE_FIELDS,
} from "@/domain/legal/partnerVerification";
import {
  PARTNER_DOCUMENT_ROWS,
  PARTNER_PROFILE_CONFIRMATIONS,
  PARTNER_PROFILE_TEXT_FIELDS,
} from "../_components/partnerLegalFields";

describe("partner legal profile form layout", () => {
  it("renders every field and confirmation the server requires", () => {
    for (const key of REQUIRED_PROFILE_FIELDS) {
      expect(PARTNER_PROFILE_TEXT_FIELDS).toContain(key);
    }
    for (const key of REQUIRED_PROFILE_CONFIRMATIONS) {
      expect(PARTNER_PROFILE_CONFIRMATIONS).toContain(key);
    }
  });

  it("marks required evidence the same way the server does", () => {
    const required = PARTNER_DOCUMENT_ROWS.filter((row) => row.required).map(
      (row) => row.kind
    );
    expect(required.sort()).toEqual([...REQUIRED_PROFILE_DOCUMENTS].sort());
  });
});
