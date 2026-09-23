/**
 * @jest-environment node
 */

import {
  BOOKING_TERMS_ERROR,
  buildTermsAcceptanceRecord,
  evaluateBookingTermsAcceptance,
} from "../bookingTermsAcceptance";

const platform = {
  available: true,
  checksum: "aaa",
  version: 1,
  documentType: "customer-booking-terms",
  language: "es",
};

const company = {
  available: true,
  sourceHash: "bbb",
  language: "es",
};

const payload = {
  platform: { accepted: true, checksum: "AAA" },
  company: { accepted: true, sourceHash: "BBB" },
};

describe("evaluateBookingTermsAcceptance", () => {
  it("skips admin and offline stubs", () => {
    expect(
      evaluateBookingTermsAcceptance({
        skip: true,
        payload: {},
        platform: { available: false },
      })
    ).toEqual({ ok: true });
  });

  it("blocks when platform terms are unpublished", () => {
    expect(
      evaluateBookingTermsAcceptance({
        payload,
        platform: { available: false },
        company,
      }).code
    ).toBe(BOOKING_TERMS_ERROR.PLATFORM_UNAVAILABLE);
  });

  it("requires both acceptances when company rules exist", () => {
    expect(
      evaluateBookingTermsAcceptance({
        payload: { platform: { accepted: true, checksum: "aaa" } },
        platform,
        company,
      }).code
    ).toBe(BOOKING_TERMS_ERROR.COMPANY_REQUIRED);
  });

  it("rejects a stale platform checksum", () => {
    expect(
      evaluateBookingTermsAcceptance({
        payload: {
          platform: { accepted: true, checksum: "old" },
          company: { accepted: true, sourceHash: "bbb" },
        },
        platform,
        company,
      }).code
    ).toBe(BOOKING_TERMS_ERROR.PLATFORM_STALE);
  });

  it("does not require company rules that have not been uploaded", () => {
    expect(
      evaluateBookingTermsAcceptance({
        payload: { platform: { accepted: true, checksum: "aaa" } },
        platform,
        company: { available: false },
      })
    ).toEqual({ ok: true });
  });

  it("accepts matching hashes case-insensitively", () => {
    expect(
      evaluateBookingTermsAcceptance({ payload, platform, company })
    ).toEqual({ ok: true });
  });
});

describe("buildTermsAcceptanceRecord", () => {
  it("stores both slices when company rules were shown", () => {
    const at = new Date("2026-09-21T12:00:00.000Z");
    expect(
      buildTermsAcceptanceRecord({ payload, platform, company, acceptedAt: at })
    ).toEqual({
      platform: {
        accepted: true,
        acceptedAt: at,
        documentType: "customer-booking-terms",
        version: 1,
        checksum: "aaa",
        language: "es",
      },
      company: {
        accepted: true,
        acceptedAt: at,
        sourceHash: "bbb",
        language: "es",
      },
    });
  });
});
