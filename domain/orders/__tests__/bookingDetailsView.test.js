/**
 * @jest-environment node
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import {
  FINANCIAL_INVARIANT,
  bookingDetailsActions,
  bookingDisplayReference,
  buildBookingDetailsView,
  buildBookingFinancialView,
} from "@/domain/orders/bookingDetailsView";

const COMPANY = "64a000000000000000000001";
const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const superadmin = { isAdmin: true, role: 2 };

/** €165 that genuinely adds up: €120 rental + €30 insurance + €15 child seat. */
function consistentOrder(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: COMPANY,
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    publicReference: "RVR-7K4P9",
    orderNumber: "1758800000000",
    carModel: "Seat Ibiza",
    numberOfDays: 5,
    insurance: "CDW",
    ChildSeats: 1,
    totalPrice: 165,
    authoritativePrice: {
      currency: "EUR",
      grossMinor: 16500,
      baseRentalMinor: 12000,
      insuranceMinor: 3000,
      extrasMinor: 1500,
      pickupFeeMinor: 0,
      returnFeeMinor: 0,
      marketplaceBookingFeeBps: 3000,
      platformAmountMinor: 4950,
      prepaymentMinor: 4950,
      supplierBalanceMinor: 11550,
      balanceMinor: 11550,
    },
    ...overrides,
  };
}

describe("price summary", () => {
  test("line items equal the displayed total", () => {
    const financial = buildBookingFinancialView(consistentOrder());
    expect(financial.lineItemsMinor).toBe(16500);
    expect(financial.totalRentalPriceMinor).toBe(16500);
    expect(financial.invariant).toBe(FINANCIAL_INVARIANT.OK);
    expect(financial.invariantOk).toBe(true);
    expect(financial.splitRenderable).toBe(true);
  });

  test("the supplier figure is the gross minus the booking fee actually captured", () => {
    const financial = buildBookingFinancialView(consistentOrder());
    expect(financial.paidToRovaroMinor).toBe(4950);
    expect(financial.payableToSupplierMinor).toBe(11550);
    expect(financial.paidToRovaroMinor + financial.payableToSupplierMinor).toBe(
      financial.totalRentalPriceMinor
    );
  });

  test("the rate comes from the order's own snapshot, not from a hardcoded 10%", () => {
    const thirtyPercent = buildBookingFinancialView(consistentOrder());
    expect(thirtyPercent.feeBps).toBe(3000);
    expect(thirtyPercent.feePercentLabel).toBe("30");

    const tenPercent = buildBookingFinancialView(
      consistentOrder({
        authoritativePrice: {
          currency: "EUR",
          grossMinor: 16500,
          baseRentalMinor: 12000,
          insuranceMinor: 3000,
          extrasMinor: 1500,
          marketplaceBookingFeeBps: 1000,
          platformAmountMinor: 1650,
          prepaymentMinor: 1650,
          supplierBalanceMinor: 14850,
          balanceMinor: 14850,
        },
      })
    );
    expect(tenPercent.feePercentLabel).toBe("10");
    expect(tenPercent.payableToSupplierMinor).toBe(14850);
  });

  test("€265 cannot be displayed when the persisted line items total €165", () => {
    const contradicted = consistentOrder({
      totalPrice: 265,
      authoritativePrice: {
        ...consistentOrder().authoritativePrice,
        grossMinor: 26500,
      },
    });
    const financial = buildBookingFinancialView(contradicted);

    expect(financial.lineItemsMinor).toBe(16500);
    expect(financial.totalRentalPriceMinor).toBe(16500);
    expect(financial.totalRentalPrice).toBe(165);
    expect(financial.invariant).toBe(FINANCIAL_INVARIANT.LINE_ITEMS_DO_NOT_SUM);
    expect(financial.contradictingStoredTotalMinor).toBe(26500);
    expect(financial.differenceMinor).toBe(10000);

    // No second total reaches the supplier: the split derived from the
    // contradicted gross is withheld entirely.
    expect(financial.splitRenderable).toBe(false);
    const rendered = financial.lineItems.map((row) => row.minor);
    expect(rendered).not.toContain(26500);
    expect(rendered.reduce((sum, n) => sum + n, 0)).toBe(
      financial.totalRentalPriceMinor
    );
  });

  test("money-changing actions are withdrawn while the numbers contradict", () => {
    const contradicted = consistentOrder({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
      authoritativePrice: {
        ...consistentOrder().authoritativePrice,
        grossMinor: 26500,
      },
    });
    const capabilities = resolveOrderCapabilities(contradicted, superadmin);
    const view = buildBookingDetailsView({ order: contradicted, capabilities });

    expect(capabilities[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(true);
    expect(view.moneyActionsDisabled).toBe(true);
    expect(bookingDetailsActions(capabilities, view).primary).not.toContain(
      BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING
    );

    const healthy = buildBookingDetailsView({
      order: consistentOrder({
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      }),
      capabilities,
    });
    expect(healthy.moneyActionsDisabled).toBe(false);
    expect(bookingDetailsActions(capabilities, healthy).primary).toContain(
      BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING
    );
  });
});

describe("title and sections", () => {
  test("the public reference is the primary title, not the timestamp order number", () => {
    expect(bookingDisplayReference(consistentOrder())).toBe("RVR-7K4P9");
    expect(
      bookingDisplayReference(consistentOrder({ publicReference: "" }))
    ).toBe("1758800000000");
  });

  test("a new request hides contacts and documents and offers three decisions", () => {
    const order = consistentOrder();
    const capabilities = resolveOrderCapabilities(order, companyAdmin);
    const view = buildBookingDetailsView({ order, capabilities });

    expect(view.customer.visible).toBe(false);
    expect(view.customer.phone).toBeUndefined();
    expect(view.documents.visible).toBe(false);
    expect(bookingDetailsActions(capabilities, view)).toEqual({
      primary: [
        BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE,
        BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT,
        BOOKING_CAPABILITY.DECLINE_REQUEST,
      ],
      secondary: [BOOKING_CAPABILITY.CONTACT_ROVARO],
    });
  });

  test("a paid booking reveals the customer to the owning company only", () => {
    const order = consistentOrder({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      confirmed: true,
      payment: { status: "paid" },
      customerName: "Maria Costa",
      phone: "+34600000000",
      email: "maria@example.com",
      Whatsapp: true,
      hasDrivingLicence: true,
      returnAtUtc: "2026-10-01T10:00:00.000Z",
    });
    const capabilities = resolveOrderCapabilities(order, companyAdmin, {
      now: new Date("2026-09-29T10:00:00.000Z"),
    });
    const view = buildBookingDetailsView({ order, capabilities });

    expect(view.customer).toMatchObject({
      visible: true,
      name: "Maria Costa",
      phone: "+34600000000",
      email: "maria@example.com",
    });
    expect(view.customer.messengers.whatsapp).toBe(true);
    expect(view.documents).toEqual({ visible: true, uploaded: true });

    const stranger = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 1,
      ownerId: "64a000000000000000000002",
    });
    expect(buildBookingDetailsView({ order, capabilities: stranger })).toBeNull();
  });

  test("an awaiting-payment booking keeps contacts and licence hidden", () => {
    const order = consistentOrder({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      customerName: "Maria Costa",
      phone: "+34600000000",
      hasDrivingLicence: true,
    });
    const capabilities = resolveOrderCapabilities(order, companyAdmin);
    const view = buildBookingDetailsView({ order, capabilities });

    expect(view.customer.visible).toBe(false);
    expect(view.documents.visible).toBe(false);
    expect(bookingDetailsActions(capabilities, view)).toEqual({
      primary: [],
      secondary: [BOOKING_CAPABILITY.CONTACT_ROVARO],
    });
  });
});
