/**
 * @jest-environment node
 */

import {
  hashRentalTermsSource,
  pickCompanyRentalTermsForLanguage,
  validateRentalTermsSource,
} from "../customerRentalTerms";
import { CUSTOMER_RENTAL_TERMS_MAX_CHARS } from "../customerRentalTermsConstants";

describe("hashRentalTermsSource", () => {
  it("is stable across CRLF and surrounding whitespace", () => {
    expect(hashRentalTermsSource("  a\r\nb  ")).toBe(hashRentalTermsSource("a\nb"));
  });
});

describe("pickCompanyRentalTermsForLanguage", () => {
  const stored = {
    sourceEn: "No smoking.",
    sourceHash: hashRentalTermsSource("No smoking."),
    translations: { es: "Prohibido fumar.", ru: "Не курить." },
  };

  it("returns unavailable when the company has not uploaded rules", () => {
    expect(pickCompanyRentalTermsForLanguage({}, "es")).toMatchObject({
      available: false,
      body: "",
    });
  });

  it("returns the matching translation", () => {
    expect(pickCompanyRentalTermsForLanguage(stored, "es-ES")).toMatchObject({
      available: true,
      body: "Prohibido fumar.",
      language: "es",
      fellBackToEnglish: false,
    });
  });

  it("falls back to English when that locale is not translated yet", () => {
    expect(pickCompanyRentalTermsForLanguage(stored, "el")).toMatchObject({
      available: true,
      body: "No smoking.",
      language: "en",
      fellBackToEnglish: true,
      sourceHash: stored.sourceHash,
    });
  });
});

describe("validateRentalTermsSource", () => {
  it("rejects text over the character cap", () => {
    const tooLong = "x".repeat(CUSTOMER_RENTAL_TERMS_MAX_CHARS + 1);
    expect(validateRentalTermsSource(tooLong).ok).toBe(false);
  });
});
