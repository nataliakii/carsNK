/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import {
  BOOKING_CAPABILITY,
  BOOKING_DETAILS_MODAL,
  INTERNAL_ORDER_MODAL,
  bookingModalName,
  capabilitiesForOrder,
  decideOrderUpdate,
  resolveBookingCapabilities,
} from "@/domain/booking/resolveBookingCapabilities";
import {
  NEW_REQUEST_ACTIONS,
  PLATFORM_FORBIDDEN_CONTROLS,
  buildBookingDetailsView,
  buildBookingPriceSummary,
} from "@/domain/booking/bookingDetailsView";
import { resolveOrdersModalTarget } from "@/domain/admin/ordersModalQuery";
import { supplierCanReadOrder } from "@/domain/admin/supplierOrderAccess";
import {
  LICENCE_CAPTURE_CODE,
  validateDrivingLicenceCapture,
} from "@/domain/legal/drivingLicenceSnapshot";

const COMPANY = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";
const ORDER_ID = "64a0000000000000000000aa";

const companyUser = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherUser = { isAdmin: true, role: 1, ownerId: OTHER };
const superadmin = { isAdmin: true, role: 2 };

function platform(overrides = {}) {
  return {
    _id: ORDER_ID,
    source: "PLATFORM",
    my_order: true,
    ownerId: COMPANY,
    publicReference: "RVR-7K4P9",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    carModel: "Toyota Yaris",
    car: { transmission: "Automatic", class: "Economy", seats: 5 },
    ...overrides,
  };
}

describe("one booking details modal", () => {
  test("calendar, orders list, and the email deep link use BookingDetailsModal", () => {
    const root = path.join(__dirname, "../../..");
    const calendar = fs.readFileSync(
      path.join(root, "app/components/calendar-ui/CalendarOverlays.js"),
      "utf8"
    );
    const list = fs.readFileSync(
      path.join(root, "app/admin/features/orders/OrdersTableSection.js"),
      "utf8"
    );
    expect(calendar).toContain("BookingDetailsModal");
    expect(list).toContain("BookingDetailsModal");
    expect(bookingModalName(platform())).toBe(BOOKING_DETAILS_MODAL);
    expect(bookingModalName({ source: "INTERNAL", my_order: false, ownerId: COMPANY })).toBe(
      INTERNAL_ORDER_MODAL
    );

    const target = resolveOrdersModalTarget({
      orderId: ORDER_ID,
      order: platform(),
      access: supplierCanReadOrder(companyUser, platform()),
    });
    expect(target.modal).toBe(BOOKING_DETAILS_MODAL);
    expect(target.stage).toBe("AWAITING_SUPPLIER_CONFIRMATION");
  });

  test("company admin sees no generic edit controls on a PLATFORM order", () => {
    const view = buildBookingDetailsView(platform(), companyUser);
    expect(view.title).toBe("Booking details");
    expect(view.reference).toBe("RVR-7K4P9");
    expect(view.editable).toBe(false);
    expect(view.title).not.toBe("Edit order");
    for (const label of PLATFORM_FORBIDDEN_CONTROLS) {
      expect(view.actions.map((action) => action.label)).not.toContain(label);
    }
    expect(view.actions.map((action) => action.label)).toEqual(NEW_REQUEST_ACTIONS);
  });

  test("company admin cannot change dates, price, insurance, extras, or locations", () => {
    for (const payload of [
      { rentalEndDate: "2026-10-01" },
      { totalPrice: 10 },
      { insurance: "CDW" },
      { ChildSeats: 1 },
      { placeIn: "Airport" },
      { offline: true },
      { source: "INTERNAL" },
    ]) {
      const decision = decideOrderUpdate({
        order: platform(),
        user: companyUser,
        payload,
      });
      expect(decision.ok).toBe(false);
      expect(decision.status).toBe(403);
      expect(decision.code).toBe("CAPABILITY_DENIED");
    }
  });

  test("supplier confirmation cannot be reversed by the supplier", () => {
    const waiting = platform({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      confirmed: true,
    });
    const decision = decideOrderUpdate({
      order: waiting,
      user: companyUser,
      payload: { confirmed: false },
    });
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe(409);
    const view = buildBookingDetailsView(waiting, companyUser);
    expect(view.actions.map((action) => action.id)).toEqual(["contactRovaro"]);
    expect(view.showContacts).toBe(false);
    expect(view.showLicence).toBe(false);
    expect(view.privacyNotice).toMatch(/after the booking payment/i);
  });

  test("a paid booking reveals contacts and the licence only to the owning company", () => {
    const paid = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
      customerName: "Ana",
      phone: "+34111",
      email: "ana@example.com",
      drivingLicenceSnapshot: { holderName: "Ana", licenceNumber: "ES12345" },
    });
    const owner = buildBookingDetailsView(paid, companyUser);
    expect(owner.statusTitle).toBe("Confirmed and paid");
    expect(owner.showContacts).toBe(true);
    expect(owner.customer.phone).toBe("+34111");
    expect(owner.showLicence).toBe(true);
    expect(owner.licence.licenceNumber).toBe("ES12345");
    expect(owner.editable).toBe(false);

    const stranger = capabilitiesForOrder(paid, otherUser);
    expect(stranger.has(BOOKING_CAPABILITY.VIEW_BOOKING)).toBe(false);
    expect(stranger.has(BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS)).toBe(false);
    expect(supplierCanReadOrder(otherUser, paid).ok).toBe(false);
  });

  test("€265 is not shown when the persisted line items total €165", () => {
    const price = buildBookingPriceSummary(
      platform({
        totalPrice: 265,
        authoritativePrice: {
          currency: "EUR",
          baseRentalMinor: 16500,
          grossMinor: 16500,
        },
      })
    );
    expect(price.consistent).toBe(false);
    expect(price.totalText).toBeNull();
    expect(price.dataWarning).toBe(true);
    expect(price.lineSum).toBe(16500);
    expect(String(price.totalText)).not.toContain("265");

    const aligned = buildBookingPriceSummary(
      platform({
        totalPrice: 165,
        authoritativePrice: {
          currency: "EUR",
          baseRentalMinor: 15000,
          insuranceMinor: 1500,
          grossMinor: 16500,
        },
      })
    );
    expect(aligned.consistent).toBe(true);
    expect(aligned.totalText).toBe("€165.00");
    expect(aligned.lines.reduce((sum, line) => sum + line.minor, 0)).toBe(aligned.totalMinor);
  });

  test("INTERNAL editing is a different modal and is not granted on PLATFORM orders", () => {
    const internalCaps = resolveBookingCapabilities({
      source: "INTERNAL",
      status: "INTERNAL",
      role: "company_admin",
      companyId: COMPANY,
      orderCompanyId: COMPANY,
    });
    expect(internalCaps.has(BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING)).toBe(true);
    expect(internalCaps.has(BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE)).toBe(false);

    const platformCaps = capabilitiesForOrder(platform(), companyUser);
    expect(platformCaps.has(BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING)).toBe(false);
  });

  test("superadmin amendment requires a reason and cannot rewrite paid terms", () => {
    const open = decideOrderUpdate({
      order: platform(),
      user: superadmin,
      payload: { totalPrice: 180 },
    });
    expect(open.ok).toBe(false);
    expect(open.code).toBe("AMENDMENT_REASON_REQUIRED");

    const paid = decideOrderUpdate({
      order: platform({
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      }),
      user: superadmin,
      payload: {
        totalPrice: 180,
        amendmentReason: "Customer asked",
        amendmentRequestedBy: "customer",
      },
    });
    expect(paid.ok).toBe(false);
    expect(paid.status).toBe(409);
    expect(paid.code).toBe("PAID_TERMS_IMMUTABLE");
  });

  test("a public request without a licence upload is rejected and a failed upload does not pass", () => {
    const missing = validateDrivingLicenceCapture({ payload: null, upload: null });
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe(LICENCE_CAPTURE_CODE.REQUIRED);

    const failed = validateDrivingLicenceCapture({
      payload: {
        holderName: "Ana Ruiz",
        licenceNumber: "ES12345",
        issuingCountry: "ES",
        expiryDate: "2030-01-01",
        issueDate: "2020-01-01",
      },
      upload: {
        storageReference: "licences/ana",
        checksum: "not-a-checksum",
        uploadedAt: "2026-09-01T00:00:00.000Z",
      },
      returnAtUtc: "2026-10-01",
      pickupAtUtc: "2026-09-29",
    });
    expect(failed.ok).toBe(false);
    expect(failed.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_FAILED);
  });

  test("the order update API calls the capability resolver", () => {
    const root = path.join(__dirname, "../../..");
    const route = fs.readFileSync(
      path.join(root, "app/api/order/update/[orderId]/route.js"),
      "utf8"
    );
    const create = fs.readFileSync(
      path.join(root, "app/api/order/add/route.js"),
      "utf8"
    );
    expect(route).toContain("decideOrderUpdate");
    expect(create).toContain("validateDrivingLicenceCapture");
  });
});
