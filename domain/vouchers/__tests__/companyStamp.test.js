/**
 * @jest-environment node
 */

import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
  isNataliCarsCompany,
} from "@/domain/vouchers/companyStamp";

describe("companyStamp", () => {
  it("detects Natali Cars", () => {
    expect(isNataliCarsCompany({ name: "Natali Cars" })).toBe(true);
    expect(isNataliCarsCompany({ name: "Other Rentals" })).toBe(false);
  });

  it("never gives Natali stamp to another company", () => {
    expect(
      getCompanyVoucherStampSrc({
        name: "Partner Co",
        voucherStampSrc: "/vouchers/natali-cars-stamp.png",
      })
    ).toBe("");
    expect(getCompanyVoucherStampSrc({ name: "Partner Co" })).toBe("");
  });

  it("returns Natali stamp only for Natali", () => {
    expect(getCompanyVoucherStampSrc({ name: "Natali Cars" })).toBe(
      "/vouchers/natali-cars-stamp.png"
    );
  });

  it("builds partner defaults from company record", () => {
    const d = buildCompanyVoucherDefaults({
      name: "Aegean Drive",
      address: "Athens",
      tel: "+30 111",
    });
    expect(d.companyHeaderTitle).toBe("Aegean Drive");
    expect(d.companyInfo).toContain("Athens");
    expect(d.stampSrc).toBe("");
  });
});
