import {
  ADDRESS_REQUIRED,
  PICKUP_OFFICE_REQUIRED,
  RETURN_OFFICE_REQUIRED,
  canonicalOfficeId,
  resolveEffectiveBookingLocation,
  resolveSelectedOfficeId,
  validateCustomerBookingLocation,
  assertCustomerLocationMethods,
} from "../bookingLocationSelection";

const OFFICE_A = "64b64b64b64b64b64b64b64b";
const OFFICE_B = "64b64b64b64b64b64b64b64c";

describe("office pickup booking selection", () => {
  test("office pickup with same return needs no address and both fees are zero", () => {
    const result = validateCustomerBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: OFFICE_A,
      sameReturnLocation: true,
    });
    expect(result.ok).toBe(true);
    expect(result.location.pickupOfficeId).toBe(OFFICE_A);
    expect(result.location.returnOfficeId).toBe(OFFICE_A);
    expect(result.location.returnMethod).toBe("office");
    expect(result.location.pickupPlaceId).toBe("");
    expect(result.location.returnPlaceId).toBe("");
    expect(result.location.pickupFee).toBe(0);
    expect(result.location.returnFee).toBe(0);
  });

  test("different return office is valid", () => {
    const result = validateCustomerBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: OFFICE_A,
      sameReturnLocation: false,
      returnMethod: "office",
      returnOfficeId: OFFICE_B,
    });
    expect(result.ok).toBe(true);
    expect(result.location.returnOfficeId).toBe(OFFICE_B);
  });

  test("office pickup without an office is blocked", () => {
    const result = validateCustomerBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: "",
      sameReturnLocation: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.placeIn).toBe(PICKUP_OFFICE_REQUIRED);
  });

  test("delivery still requires a verified place", () => {
    const missing = validateCustomerBookingLocation({
      pickupMethod: "delivery",
      pickupPlaceId: "",
      sameReturnLocation: true,
    });
    expect(missing.errors.placeInDetail).toBe(ADDRESS_REQUIRED);
    const ok = validateCustomerBookingLocation({
      pickupMethod: "delivery",
      pickupPlaceId: "ChIJbcn",
      sameReturnLocation: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.location.returnPlaceId).toBe("ChIJbcn");
  });

  test("delivery to office drops the place id and delivery fee", () => {
    const next = resolveEffectiveBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: OFFICE_A,
      pickupPlaceId: "ChIJstale",
      sameReturnLocation: true,
      returnPlaceId: "ChIJstale",
    });
    expect(next.pickupPlaceId).toBe("");
    expect(next.returnPlaceId).toBe("");
    expect(next.pickupFee).toBe(0);
    expect(next.returnFee).toBe(0);
  });

  test("same return derives the office immediately and follows a new pickup office", () => {
    const first = resolveEffectiveBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: OFFICE_A,
      sameReturnLocation: true,
      returnOfficeId: OFFICE_B,
    });
    expect(first.returnOfficeId).toBe(OFFICE_A);
    const second = resolveEffectiveBookingLocation({
      pickupMethod: "office",
      pickupOfficeId: OFFICE_B,
      sameReturnLocation: true,
    });
    expect(second.returnOfficeId).toBe(OFFICE_B);
  });

  test("card id and submitted id are the same canonical value", () => {
    const office = { _id: OFFICE_A, name: "QA Office A Example" };
    expect(canonicalOfficeId(office)).toBe(OFFICE_A);
    const submitted = resolveEffectiveBookingLocation({
      pickupMethod: "OFFICE",
      pickupOfficeId: canonicalOfficeId(office),
      sameReturnLocation: true,
    });
    expect(submitted.pickupOfficeId).toBe(canonicalOfficeId(office));
  });

  test("server accepts office same-return without a place id", () => {
    const check = assertCustomerLocationMethods({
      pickup: { kind: "office", officeId: OFFICE_A, placeId: "" },
      dropoff: { sameAsPickup: true, kind: "", officeId: "", placeId: "" },
    });
    expect(check.ok).toBe(true);
    expect(check.location.returnOfficeId).toBe(OFFICE_A);
  });

  test("keeps a valid office and auto-selects only a single office", () => {
    const offices = [{ _id: OFFICE_A }, { _id: OFFICE_B }];
    expect(resolveSelectedOfficeId(offices, OFFICE_B)).toBe(OFFICE_B);
    expect(resolveSelectedOfficeId(offices, "")).toBe("");
    expect(resolveSelectedOfficeId([{ _id: OFFICE_A }], "")).toBe(OFFICE_A);
  });

  test("server asks for a return office only when same return is off", () => {
    const check = assertCustomerLocationMethods({
      pickup: { kind: "office", officeId: OFFICE_A },
      dropoff: { sameAsPickup: false, kind: "office", officeId: "" },
    });
    expect(check.ok).toBe(false);
    expect(check.message).toBe(RETURN_OFFICE_REQUIRED);
  });
});
