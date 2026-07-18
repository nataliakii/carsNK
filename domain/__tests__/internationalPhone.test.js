import {
  normalizeInternationalPhoneDigits,
  isValidInternationalPhone,
} from "../validation/internationalPhone.js";

describe("normalizeInternationalPhoneDigits", () => {
  it("handles + and separators", () => {
    expect(normalizeInternationalPhoneDigits("+30 697-123 4567")).toBe(
      "306971234567"
    );
  });
  it("handles 00 prefix", () => {
    expect(normalizeInternationalPhoneDigits("00306971234567")).toBe(
      "306971234567"
    );
  });
  it("strips extra leading 0 after +", () => {
    expect(normalizeInternationalPhoneDigits("+0030 697 123 4567")).toBe(
      "306971234567"
    );
  });
});

describe("isValidInternationalPhone", () => {
  it("accepts Greece +30 mobile", () => {
    expect(isValidInternationalPhone("+30 697 123 4567")).toBe(true);
  });
  it("accepts US NANP +1", () => {
    expect(isValidInternationalPhone("+1 212 555 1234")).toBe(true);
  });
  it("accepts Russia +7", () => {
    expect(isValidInternationalPhone("+7 916 123 45 67")).toBe(true);
  });
  it("accepts NANP territory +1242", () => {
    expect(isValidInternationalPhone("+1 242 365 1234")).toBe(true);
  });
  it("rejects too short", () => {
    expect(isValidInternationalPhone("+30 697")).toBe(false);
  });
  it("rejects trunk zero in national part", () => {
    expect(isValidInternationalPhone("+39 0320 1234567")).toBe(false);
  });
  it("rejects US with wrong national length", () => {
    expect(isValidInternationalPhone("+1 212 555 12")).toBe(false);
  });
});
