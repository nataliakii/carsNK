/**
 * @jest-environment node
 *
 * A contractor must not learn who the customer is before the booking payment
 * lands, and privacy here is a property of the payload, not of the stylesheet.
 * These tests pin both layers: what the server is willing to serialise, and
 * what the modal's read model is willing to expose.
 */

import fs from "node:fs";
import path from "node:path";

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import {
  CLIENT_PRIVATE_FIELDS,
  applyVisibilityToOrder,
} from "@/domain/orders/orderVisibility";
import { buildBookingDetailsView } from "@/domain/booking/bookingDetailsView";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = { isAdmin: true, role: 1, ownerId: OTHER_COMPANY };
const superadmin = { isAdmin: true, role: 2 };

const CONTACTS = {
  customerName: "Marta Kowalska",
  phone: "+48 600 123 456",
  email: "marta.kowalska.with.a.long.address@example.com",
  Viber: true,
  Whatsapp: true,
  Telegram: false,
};

function request(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: COMPANY,
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    drivingLicenceUrls: ["https://example.com/licence.jpg"],
    ...CONTACTS,
    ...overrides,
  };
}

const paid = (overrides = {}) =>
  request({
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: { status: "paid" },
    ...overrides,
  });

describe("response shaping decides privacy, not the UI", () => {
  test("a new request reaches the contractor with no contact fields at all", () => {
    const shaped = applyVisibilityToOrder(request(), companyAdmin);
    for (const field of CLIENT_PRIVATE_FIELDS) {
      if (field === "customerName") continue;
      expect(shaped[field]).toBeUndefined();
    }
    expect(JSON.stringify(shaped)).not.toContain(CONTACTS.phone);
    expect(JSON.stringify(shaped)).not.toContain(CONTACTS.email);
  });

  test("the customer's name is masked rather than sent in full", () => {
    const shaped = applyVisibilityToOrder(request(), companyAdmin);
    expect(shaped.customerName).not.toBe(CONTACTS.customerName);
    expect(shaped.customerName).toContain("***");
  });

  test("driving documents do not reach the contractor before payment", () => {
    const shaped = applyVisibilityToOrder(request(), companyAdmin);
    expect(shaped.drivingLicenceUrls).toBeUndefined();
    expect(shaped.drivingLicenceSnapshot).toBeUndefined();
    expect(shaped.hasDrivingLicence).toBeUndefined();
  });

  test("a paid booking releases the contacts to the owning company", () => {
    const shaped = applyVisibilityToOrder(paid(), companyAdmin);
    expect(shaped.phone).toBe(CONTACTS.phone);
    expect(shaped.email).toBe(CONTACTS.email);
    expect(shaped.customerName).toBe(CONTACTS.customerName);
  });

  test("a paid booking still never ships the document storage pointers", () => {
    const shaped = applyVisibilityToOrder(paid(), companyAdmin);
    expect(shaped.drivingLicenceUrls).toBeUndefined();
    expect(shaped.hasDrivingLicence).toBe(true);
  });

  test("the superadmin receives the contacts, which is the platform support path", () => {
    const shaped = applyVisibilityToOrder(request(), superadmin);
    expect(shaped.phone).toBe(CONTACTS.phone);
    expect(shaped.email).toBe(CONTACTS.email);
  });
});

describe("the modal read model repeats the same answer", () => {
  test("a new request shows the contractor a protected-information notice", () => {
    const view = buildBookingDetailsView(request(), companyAdmin);
    expect(view.showContacts).toBe(false);
    expect(view.customer).toBeNull();
    expect(view.showPrivacyNotice).toBe(true);
    expect(view.canContactCustomer).toBe(false);
  });

  test("awaiting payment still hides the contacts", () => {
    const awaiting = request({
      bookingStatus: BOOKING_STATUS.AWAITING_CUSTOMER_PAYMENT,
    });
    const view = buildBookingDetailsView(awaiting, companyAdmin);
    expect(view.showContacts).toBe(false);
    expect(view.customer).toBeNull();
  });

  test("a confirmed paid booking reveals the contacts to the owning company", () => {
    const view = buildBookingDetailsView(paid(), companyAdmin);
    expect(view.showContacts).toBe(true);
    expect(view.canContactCustomer).toBe(true);
    expect(view.customer.phone).toBe(CONTACTS.phone);
    expect(view.customer.email).toBe(CONTACTS.email);
  });

  test("another company sees neither contacts nor documents on a paid booking", () => {
    const view = buildBookingDetailsView(paid(), otherCompanyAdmin);
    expect(view.showContacts).toBe(false);
    expect(view.showLicence).toBe(false);
    expect(view.customer).toBeNull();
  });

  test("superadmin pre-payment contacts stay available without a support banner", () => {
    const view = buildBookingDetailsView(request(), superadmin);
    expect(view.showContacts).toBe(true);
    expect(view.platformSupportView).toBe(false);
  });

  test("platform support banner stays off after payment too", () => {
    expect(buildBookingDetailsView(paid(), superadmin).platformSupportView).toBe(
      false
    );
    expect(
      buildBookingDetailsView(paid(), companyAdmin).platformSupportView
    ).toBe(false);
  });

  test("the contractor is offered amendment only after payment", () => {
    const unpaidIds = buildBookingDetailsView(request(), companyAdmin).actions.map(
      (action) => action.id
    );
    expect(unpaidIds).not.toContain("amend");

    const paidIds = buildBookingDetailsView(paid(), companyAdmin).actions.map(
      (action) => action.id
    );
    expect(paidIds).toContain("amend");
  });
});

describe("contacts are copied in place, not restated in a dialog", () => {
  const modal = fs.readFileSync(
    path.join(
      process.cwd(),
      "app/admin/features/orders/modals/BookingDetailsModal.js"
    ),
    "utf8"
  );

  test("the Contact customer action and its dialog are gone", () => {
    expect(modal).not.toContain("contactCustomer");
    const view = buildBookingDetailsView(paid(), companyAdmin);
    expect(view.actions.map((action) => action.id)).not.toContain(
      "contactCustomer"
    );
  });

  test("phone and email are rendered as copyable contacts", () => {
    expect(modal).toContain("CopyableContact");
    expect(modal).toContain("bookingDetails.customer.copyPhone");
    expect(modal).toContain("bookingDetails.customer.copyEmail");
    expect(modal).toContain("bookingDetails.customer.copied");
  });

  test("they remain reachable as tel: and mailto: links", () => {
    expect(modal).toMatch(/href=\{`tel:\$\{view\.customer\.phone\}`\}/);
    expect(modal).toMatch(/href=\{`mailto:\$\{view\.customer\.email\}`\}/);
  });

  test("a long address wraps instead of widening the panel", () => {
    const control = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/admin/features/orders/components/CopyableContact.js"
      ),
      "utf8"
    );
    expect(control).toContain('overflowWrap: "anywhere"');
    expect(control).toContain('wordBreak: "break-word"');
    expect(control).toContain("minWidth: 0");
  });
});
