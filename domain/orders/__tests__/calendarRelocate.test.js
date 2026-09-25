import {
  CALENDAR_RELOCATE_CODE,
  assertCalendarRelocateAllowed,
  isPaidPlatformBookingForRelocate,
  requiresCustomerAckForRelocate,
} from "../calendarRelocate";

describe("calendarRelocate", () => {
  const paidPlatform = {
    source: "PLATFORM",
    my_order: true,
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: "BOOKING_CONFIRMED",
    payment: { status: "paid" },
  };

  const unpaidPlatform = {
    source: "PLATFORM",
    my_order: true,
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: "PAYMENT_PROCESSING",
    payment: { status: "pending" },
    confirmed: true,
  };

  const internal = {
    source: "INTERNAL",
    my_order: false,
  };

  test("paid platform requires customer ack", () => {
    expect(requiresCustomerAckForRelocate(paidPlatform)).toBe(true);
    expect(isPaidPlatformBookingForRelocate(paidPlatform)).toBe(true);
    const denied = assertCalendarRelocateAllowed({
      order: paidPlatform,
      access: {
        isViewOnly: false,
        canEditPickupDate: false,
        canEditReturnDate: true,
      },
      fieldsInPayload: ["rentalStartDate", "rentalEndDate"],
      customerAck: false,
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe(CALENDAR_RELOCATE_CODE.CUSTOMER_ACK_REQUIRED);

    const allowed = assertCalendarRelocateAllowed({
      order: paidPlatform,
      access: {
        isViewOnly: false,
        canEditPickupDate: false,
        canEditReturnDate: true,
      },
      fieldsInPayload: ["rentalStartDate", "rentalEndDate", "car"],
      customerAck: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.paidRelocate).toBe(true);
  });

  test("unpaid confirmed client cannot shift start without policy", () => {
    const result = assertCalendarRelocateAllowed({
      order: unpaidPlatform,
      access: {
        isViewOnly: false,
        canEditPickupDate: false,
        canEditReturnDate: true,
        canEdit: true,
      },
      fieldsInPayload: ["rentalStartDate", "rentalEndDate"],
      customerAck: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CALENDAR_RELOCATE_CODE.FIELD_LOCKED);
    expect(result.field).toBe("rentalStartDate");
  });

  test("internal with edit rights may relocate without ack", () => {
    const result = assertCalendarRelocateAllowed({
      order: internal,
      access: {
        isViewOnly: false,
        canEditPickupDate: true,
        canEditReturnDate: true,
        canEdit: true,
      },
      fieldsInPayload: ["car"],
      customerAck: false,
    });
    expect(result.ok).toBe(true);
    expect(result.paidRelocate).toBe(false);
  });

  test("view-only unpaid is permission denied", () => {
    const result = assertCalendarRelocateAllowed({
      order: unpaidPlatform,
      access: { isViewOnly: true },
      fieldsInPayload: ["car"],
      customerAck: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CALENDAR_RELOCATE_CODE.PERMISSION_DENIED);
    expect(result.message).toMatch(/permission/i);
  });
});
