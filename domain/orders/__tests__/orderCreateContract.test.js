import { evaluateBookingTermsAcceptance } from "../bookingTermsAcceptance";
import { parseLocationQuoteInput } from "../locationQuoteInput";
import {
  ORDER_CREATE_CODE,
  attemptOutcome,
  customerMessageForCode,
  isPlatformMaintenanceLock,
  mapLocationQuoteCode,
  mapTermsErrorCode,
  persistedOfficeId,
  shouldHardBlockBan,
} from "../orderCreateContract";

const OFFICE_ID = "64b64b64b64b64b64b64b64b";

describe("office booking create contract", () => {
  test("OFFICE method with same return copies the persisted office id", () => {
    const parsed = parseLocationQuoteInput({
      pickup: {
        method: "OFFICE",
        officeId: OFFICE_ID,
      },
      return: {
        method: "OFFICE",
        officeId: OFFICE_ID,
      },
      sameReturnLocation: true,
    });
    expect(parsed.pickup.kind).toBe("office");
    expect(parsed.pickup.officeId).toBe(OFFICE_ID);
    expect(parsed.pickup.placeId).toBe("");
    expect(parsed.dropoff.kind).toBe("office");
    expect(parsed.dropoff.officeId).toBe(OFFICE_ID);
    expect(parsed.dropoff.sameAsPickup).toBe(true);
    expect(parsed.dropoff.placeId).toBe("");
  });

  test("same return derives the return office when it is omitted", () => {
    const parsed = parseLocationQuoteInput({
      location: {
        pickup: { method: "OFFICE", officeId: OFFICE_ID },
        return: { sameAsPickup: true },
      },
    });
    expect(parsed.dropoff.kind).toBe("office");
    expect(parsed.dropoff.officeId).toBe(OFFICE_ID);
  });

  test("rejects a non-persisted office id", () => {
    expect(persistedOfficeId("[object Object]")).toBe("");
    expect(persistedOfficeId({ name: "Desk" })).toBe("");
    expect(persistedOfficeId({ _id: OFFICE_ID })).toBe(OFFICE_ID);
  });

  test("missing supplier terms do not block when platform terms are accepted", () => {
    const result = evaluateBookingTermsAcceptance({
      payload: {
        platform: { accepted: true, checksum: "abc" },
      },
      platform: { available: true, checksum: "abc", version: 2 },
      company: { available: false },
    });
    expect(result.ok).toBe(true);
  });

  test("unpublished booking terms and missing acceptance have precise codes", () => {
    expect(mapTermsErrorCode("platform_terms_unavailable")).toBe(
      ORDER_CREATE_CODE.BOOKING_TERMS_NOT_PUBLISHED
    );
    expect(mapTermsErrorCode("platform_terms_required")).toBe(
      ORDER_CREATE_CODE.BOOKING_TERMS_NOT_ACCEPTED
    );
    expect(mapTermsErrorCode("company_terms_required")).toBe(
      ORDER_CREATE_CODE.SUPPLIER_TERMS_NOT_ACCEPTED
    );
    expect(customerMessageForCode(ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE)).toMatch(
      /no longer available/
    );
    expect(customerMessageForCode(ORDER_CREATE_CODE.CAR_NOT_AVAILABLE)).toMatch(
      /no longer available for the selected dates/
    );
    expect(customerMessageForCode(ORDER_CREATE_CODE.PRICE_CHANGED)).toMatch(
      /price has changed/
    );
    expect(customerMessageForCode(ORDER_CREATE_CODE.ORDER_CREATE_FAILED)).toMatch(
      /couldn’t create your booking/
    );
  });

  test("unknown office maps to OFFICE_NOT_AVAILABLE and does not require a place id", () => {
    expect(mapLocationQuoteCode("UNKNOWN_OFFICE")).toBe(
      ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE
    );
    expect(mapLocationQuoteCode("OFFICE_NOT_OWNED_BY_COMPANY")).toBe(
      ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE
    );
  });

  test("validation failures are not abuse errors, and only a maintenance lock uses the blocked sentence", () => {
    expect(attemptOutcome(400)).toBe("rejected");
    expect(attemptOutcome(403)).toBe("rejected");
    expect(attemptOutcome(409)).toBe("conflict");
    expect(attemptOutcome(201)).toBe("success");
    expect(attemptOutcome(500)).toBe("error");
    expect(
      isPlatformMaintenanceLock({ type: "maintenance", reason: "deploy" })
    ).toBe(true);
    expect(
      isPlatformMaintenanceLock({
        type: "auto",
        reason: "Too many failed or conflicting order attempts",
      })
    ).toBe(false);
    expect(
      shouldHardBlockBan({
        type: "auto",
        reason: "Too many failed or conflicting order attempts",
      })
    ).toBe(false);
    expect(shouldHardBlockBan({ type: "manual", reason: "Banned" })).toBe(true);
    expect(
      customerMessageForCode(ORDER_CREATE_CODE.PLATFORM_MAINTENANCE)
    ).toBe("Order creation is temporarily blocked");
  });
});
