/**
 * @jest-environment node
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import {
  AMENDMENT_ERROR,
  AMENDMENT_REQUESTED_BY,
  PAYMENT_RESOLUTION,
  applicableAmendmentWrites,
  validateBookingAmendment,
} from "@/domain/orders/bookingAmendment";

const ACTOR = { id: "u1", email: "ops@rovaro.autos", role: "SUPERADMIN" };
const REASON = "Customer asked to return one day later; supplier agreed.";

function paidBooking(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: "64a000000000000000000001",
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: { status: "paid", paidAmountMinor: 4950 },
    rentalEndDate: "2026-10-01T00:00:00.000Z",
    totalPrice: 165,
    insurance: "CDW",
    placeOutDetail: "Terminal 1",
    bookingFinancialSnapshot: {
      calculationVersion: 1,
      currency: "EUR",
      feeBps: 3000,
      feePercent: 30,
      grossMinor: 16500,
      bookingFeeMinor: 4950,
      supplierBalanceMinor: 11550,
    },
    ...overrides,
  };
}

describe("an amendment must explain itself", () => {
  test("a reason is required", () => {
    const result = validateBookingAmendment({
      order: paidBooking(),
      changes: { placeOutDetail: "Terminal 2" },
      reason: "typo",
      requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
      actor: ACTOR,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.REASON_REQUIRED,
    });
  });

  test("who asked for it is required", () => {
    expect(
      validateBookingAmendment({
        order: paidBooking(),
        changes: { placeOutDetail: "Terminal 2" },
        reason: REASON,
        requestedBy: "",
        actor: ACTOR,
      })
    ).toMatchObject({ ok: false, code: AMENDMENT_ERROR.REQUESTED_BY_REQUIRED });
  });

  test("the acting user is required", () => {
    expect(
      validateBookingAmendment({
        order: paidBooking(),
        changes: { placeOutDetail: "Terminal 2" },
        reason: REASON,
        requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
        actor: {},
      })
    ).toMatchObject({ ok: false, code: AMENDMENT_ERROR.ACTOR_REQUIRED });
  });

  test("a valid amendment records before, after, actor and timestamp", () => {
    const result = validateBookingAmendment({
      order: paidBooking(),
      changes: { placeOutDetail: "Terminal 2" },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.SUPPLIER,
      actor: ACTOR,
      now: new Date("2026-09-25T12:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.SUPPLIER,
      fieldsChanged: ["placeOutDetail"],
      materialFields: [],
      consentRequired: false,
      before: { placeOutDetail: "Terminal 1" },
      after: { placeOutDetail: "Terminal 2" },
      actor: ACTOR,
      at: "2026-09-25T12:00:00.000Z",
    });
    expect(result.record.financialSnapshotBefore.grossMinor).toBe(16500);
    expect(result.record.checksum).toHaveLength(64);
  });

  test("an unknown field is refused rather than written", () => {
    expect(
      validateBookingAmendment({
        order: paidBooking(),
        changes: { offline: true, source: "INTERNAL" },
        reason: REASON,
        requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
        actor: ACTOR,
      })
    ).toMatchObject({
      ok: false,
      code: AMENDMENT_ERROR.UNKNOWN_FIELD,
      fields: ["offline", "source"],
    });
  });

  test("only a platform booking is amended this way", () => {
    expect(
      validateBookingAmendment({
        order: paidBooking({ source: BOOKING_SOURCE.INTERNAL, my_order: false }),
        changes: { placeOutDetail: "Terminal 2" },
        reason: REASON,
        requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
        actor: ACTOR,
      })
    ).toMatchObject({ ok: false, status: 409, code: AMENDMENT_ERROR.NOT_PLATFORM });
  });
});

describe("a paid material term cannot change silently", () => {
  test("changing the return date after payment needs recorded consent", () => {
    const blocked = validateBookingAmendment({
      order: paidBooking(),
      changes: { rentalEndDate: "2026-10-02T00:00:00.000Z" },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.CUSTOMER,
      actor: ACTOR,
    });
    expect(blocked).toMatchObject({
      ok: false,
      status: 409,
      code: AMENDMENT_ERROR.CONSENT_REQUIRED,
      fields: ["rentalEndDate"],
    });

    const allowed = validateBookingAmendment({
      order: paidBooking(),
      changes: { rentalEndDate: "2026-10-02T00:00:00.000Z" },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.CUSTOMER,
      actor: ACTOR,
      customerConsent: { recorded: true, note: "Confirmed by email" },
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.record.consentRequired).toBe(true);
    expect(allowed.record.customerConsent.recorded).toBe(true);
  });

  test("before payment the same change needs no consent", () => {
    const unpaid = paidBooking({
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      payment: { status: "" },
    });
    const result = validateBookingAmendment({
      order: unpaid,
      changes: { insurance: "FULL" },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
      actor: ACTOR,
    });
    expect(result.ok).toBe(true);
    expect(result.record.consentRequired).toBe(false);
  });
});

describe("a price change is settled, never rewritten", () => {
  test("a lower price after payment becomes a refund decision", () => {
    const result = validateBookingAmendment({
      order: paidBooking(),
      changes: { totalPrice: 140 },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.CUSTOMER,
      actor: ACTOR,
      customerConsent: { recorded: true },
    });
    expect(result.ok).toBe(true);
    expect(result.record.paymentResolution).toBe(PAYMENT_RESOLUTION.REFUND_DUE);
    expect(result.record.financialSnapshotBefore.bookingFeeMinor).toBe(4950);
    expect(applicableAmendmentWrites(result.record, paidBooking())).toEqual({});
  });

  test("a higher price after payment becomes an additional-payment decision", () => {
    const result = validateBookingAmendment({
      order: paidBooking(),
      changes: { totalPrice: 190 },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.SUPPLIER,
      actor: ACTOR,
      customerConsent: { recorded: true },
    });
    expect(result.record.paymentResolution).toBe(
      PAYMENT_RESOLUTION.ADDITIONAL_PAYMENT_DUE
    );
  });

  test("before payment a price change is written directly", () => {
    const unpaid = paidBooking({
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      payment: { status: "" },
    });
    const result = validateBookingAmendment({
      order: unpaid,
      changes: { totalPrice: 150 },
      reason: REASON,
      requestedBy: AMENDMENT_REQUESTED_BY.ROVARO,
      actor: ACTOR,
    });
    expect(result.record.paymentResolution).toBe(PAYMENT_RESOLUTION.NONE);
    expect(applicableAmendmentWrites(result.record, unpaid)).toEqual({
      totalPrice: 150,
    });
  });
});
