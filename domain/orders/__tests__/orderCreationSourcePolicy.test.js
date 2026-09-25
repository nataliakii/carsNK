/**
 * @jest-environment node
 *
 * The rule: a superadmin creating in the admin calendar for a company that is
 * not theirs produces a PLATFORM booking that lands in that company's queue as
 * an ordinary new request. Everything else keeps behaving as it did.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import {
  BOOKING_SOURCE,
  PLATFORM_WORKFLOW_STAGE,
  contractorTableStatusLabelKey,
  isInternalBooking,
  isPlatformBooking,
  resolveContractorCalendarTone,
  resolvePlatformWorkflowStage,
  CALENDAR_TONE,
  contractorOrderMoneyRow,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import { countCompanyRentalActions } from "@/domain/orders/companyRentalActions";
import { bookingFinancialSnapshotFromQuote } from "@/domain/orders/bookingFinancialSnapshot";
import {
  ORDER_CREATION_INTENT,
  resolveCreationActorCompanyId,
  resolveOrderCreationIntent,
  resolveOrderCreationPolicy,
} from "@/domain/orders/orderCreationSourcePolicy";

const SUPPLIER = "64a000000000000000000001";
const OTHER_SUPPLIER = "64a000000000000000000002";
const PLATFORM_COMPANY = "679903bd10e6c8a8c0f027bc";

const spainContext = {
  contextBookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
  contextBookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
};

function superadminFor(targetCompanyId, overrides = {}) {
  return resolveOrderCreationPolicy({
    isAdminSession: true,
    isSuperadminActor: true,
    actorCompanyId: "",
    targetCompanyId,
    platformCompanyId: PLATFORM_COMPANY,
    ...spainContext,
    ...overrides,
  });
}

function companyAdminFor(targetCompanyId, overrides = {}) {
  return resolveOrderCreationPolicy({
    isAdminSession: true,
    isSuperadminActor: false,
    actorCompanyId: targetCompanyId,
    targetCompanyId,
    platformCompanyId: PLATFORM_COMPANY,
    ...spainContext,
    ...overrides,
  });
}

describe("a superadmin creating for another company", () => {
  const decision = superadminFor(SUPPLIER);

  test("is a PLATFORM booking awaiting that supplier's confirmation", () => {
    expect(decision.intent).toBe(
      ORDER_CREATION_INTENT.SUPERADMIN_REQUEST_FOR_COMPANY
    );
    expect(decision.source).toBe(BOOKING_SOURCE.PLATFORM);
    expect(decision.bookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
    expect(decision.confirmed).toBe(false);
  });

  test("carries the legacy PLATFORM flag, so the record is not ambiguous", () => {
    const order = {
      source: decision.source,
      my_order: decision.myOrder,
      bookingStatus: decision.bookingStatus,
      bookingMode: decision.bookingMode,
      ownerId: SUPPLIER,
    };
    expect(isPlatformBooking(order)).toBe(true);
    expect(isInternalBooking(order)).toBe(false);
    expect(resolveContractorCalendarTone(order)).toBe(CALENDAR_TONE.NEW_REQUEST);
    expect(contractorTableStatusLabelKey(order)).toBe("table.toneNewRequest");
    expect(resolvePlatformWorkflowStage(order)).toBe(
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION
    );
  });

  test("is a marketplace request, so the Rovaro Booking Fee has somewhere to live", () => {
    expect(decision.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(decision.bookingFeeApplies).toBe(true);
  });

  test("stays a marketplace request even when the company defaults to ops calendar", () => {
    const greekSupplier = superadminFor(SUPPLIER, {
      contextBookingMode: BOOKING_MODES.OPS_CALENDAR,
      contextBookingStatus: undefined,
    });
    expect(greekSupplier.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(greekSupplier.bookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
  });

  test("drops the Offline checkbox instead of producing an unpaid brokered order", () => {
    const offlineAttempt = superadminFor(SUPPLIER, { requestedOffline: true });
    expect(offlineAttempt.offline).toBe(false);
    expect(offlineAttempt.offlineIgnored).toBe(true);
    expect(offlineAttempt.source).toBe(BOOKING_SOURCE.PLATFORM);
    expect(offlineAttempt.bookingFeeApplies).toBe(true);
  });

  test("does not let a hand-typed total diverge from the priced gross", () => {
    expect(decision.trustsClientTotalPrice).toBe(false);
  });

  test("does not ask for the customer flow's verified location quote", () => {
    expect(decision.customerSelfService).toBe(false);
  });
});

describe("the supplier side of a request created this way", () => {
  const decision = superadminFor(SUPPLIER);
  const order = {
    _id: "64a0000000000000000000aa",
    source: decision.source,
    my_order: decision.myOrder,
    confirmed: decision.confirmed,
    offline: decision.offline,
    bookingMode: decision.bookingMode,
    bookingStatus: decision.bookingStatus,
    ownerId: SUPPLIER,
    totalPrice: 350,
    // Exactly what the create route freezes on the order: the quote's own
    // gross and the target company's negotiated 30% rate.
    bookingFinancialSnapshot: bookingFinancialSnapshotFromQuote({
      grossMinor: 35000,
      currency: "EUR",
      marketplaceBookingFeeBps: 3000,
      platformAmountMinor: 10500,
    }),
  };

  test("grants the target company confirm, replacement and decline", () => {
    const capabilities = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 1,
      ownerId: SUPPLIER,
    });
    expect(capabilities[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(
      true
    );
    expect(capabilities[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(true);
  });

  test("keeps the customer's contacts and licence hidden until payment", () => {
    const capabilities = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 1,
      ownerId: SUPPLIER,
    });
    expect(capabilities[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(false);
    expect(capabilities[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
  });

  test("does not give the creating superadmin the supplier's decisions", () => {
    const capabilities = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 2,
    });
    expect(capabilities[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(
      false
    );
    expect(capabilities[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(
      false
    );
    expect(capabilities[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
  });

  test("increments the company's rental action badge", () => {
    expect(countCompanyRentalActions([order])).toBe(1);
  });

  test("shows the company's negotiated fee rate in the money row", () => {
    expect(order.bookingFinancialSnapshot.feeBps).toBe(3000);
    expect(contractorOrderMoneyRow(order)).toEqual({
      source: BOOKING_SOURCE.PLATFORM,
      rentalTotal: 350,
      bookingFee: 105,
      dueToCompany: 245,
    });
  });
});

describe("a company admin creating for its own company", () => {
  test("still produces an internal record with no fee and no supplier dance", () => {
    const decision = companyAdminFor(SUPPLIER);
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.OWN_COMPANY_RECORD);
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
    expect(decision.myOrder).toBe(false);
    expect(decision.bookingMode).toBe(BOOKING_MODES.OPS_CALENDAR);
    expect(decision.bookingStatus).toBeUndefined();
    expect(decision.bookingFeeApplies).toBe(false);
    expect(decision.trustsClientTotalPrice).toBe(true);
  });

  test("keeps the Offline checkbox meaning offline and blocking", () => {
    const decision = companyAdminFor(SUPPLIER, { requestedOffline: true });
    expect(decision.offline).toBe(true);
    expect(decision.confirmed).toBe(true);
    expect(decision.offlineIgnored).toBe(false);
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
  });

  test("is never upgraded by reaching another company's car", () => {
    const decision = resolveOrderCreationPolicy({
      isAdminSession: true,
      isSuperadminActor: false,
      actorCompanyId: SUPPLIER,
      targetCompanyId: OTHER_SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      ...spainContext,
    });
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
    expect(decision.bookingFeeApplies).toBe(false);
  });
});

describe("a superadmin who is not acting for anybody else", () => {
  test("creating on Rovaro's own company keeps an internal record", () => {
    const decision = superadminFor(PLATFORM_COMPANY);
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.OWN_COMPANY_RECORD);
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
    expect(decision.bookingFeeApplies).toBe(false);
  });

  test("inside a company through view-as creates that company's own record", () => {
    const decision = resolveOrderCreationPolicy({
      isAdminSession: true,
      // view-as puts a superadmin inside the company, so they are not the
      // platform actor any more.
      isSuperadminActor: false,
      actorCompanyId: resolveCreationActorCompanyId({
        viewAsCompanyId: SUPPLIER,
        ownerId: null,
      }),
      targetCompanyId: SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      ...spainContext,
    });
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.OWN_COMPANY_RECORD);
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
  });

  test("creating on an ownerless car keeps an internal record", () => {
    const decision = superadminFor("");
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.OWN_COMPANY_RECORD);
    expect(decision.source).toBe(BOOKING_SOURCE.INTERNAL);
  });
});

describe("the paths that must not change", () => {
  test("a public request is a PLATFORM booking on the company's own terms", () => {
    const decision = resolveOrderCreationPolicy({
      isAdminSession: false,
      requestedMyOrder: false,
      requestedOffline: true,
      requestedConfirmed: true,
      targetCompanyId: SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      ...spainContext,
    });
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.PUBLIC_REQUEST);
    expect(decision.source).toBe(BOOKING_SOURCE.PLATFORM);
    expect(decision.myOrder).toBe(true);
    expect(decision.offline).toBe(false);
    expect(decision.confirmed).toBe(false);
    expect(decision.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(decision.trustsClientTotalPrice).toBe(false);
  });

  test("a public request to a Greece company keeps the ops-calendar context", () => {
    const decision = resolveOrderCreationPolicy({
      isAdminSession: false,
      targetCompanyId: SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      contextBookingMode: BOOKING_MODES.OPS_CALENDAR,
      contextBookingStatus: undefined,
    });
    expect(decision.bookingMode).toBe(BOOKING_MODES.OPS_CALENDAR);
    expect(decision.bookingStatus).toBeUndefined();
    expect(decision.bookingFeeApplies).toBe(false);
  });

  test("an admin submitting the customer flow keeps its own flags", () => {
    const decision = resolveOrderCreationPolicy({
      isAdminSession: true,
      isSuperadminActor: true,
      actorCompanyId: "",
      targetCompanyId: SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      requestedMyOrder: true,
      requestedConfirmed: true,
      ...spainContext,
    });
    expect(decision.intent).toBe(ORDER_CREATION_INTENT.ADMIN_CUSTOMER_REQUEST);
    expect(decision.source).toBe(BOOKING_SOURCE.PLATFORM);
    expect(decision.confirmed).toBe(true);
    expect(decision.customerSelfService).toBe(true);
    expect(decision.trustsClientTotalPrice).toBe(true);
  });
});

describe("the intent on its own", () => {
  test("mirrors the full policy, so the form and the server agree", () => {
    const args = {
      isAdminSession: true,
      isSuperadminActor: true,
      actorCompanyId: "",
      targetCompanyId: SUPPLIER,
      platformCompanyId: PLATFORM_COMPANY,
      requestedMyOrder: false,
    };
    expect(resolveOrderCreationIntent(args)).toBe(
      resolveOrderCreationPolicy({ ...args, ...spainContext }).intent
    );
  });

  test("resolves the acting company from view-as first, then the session", () => {
    expect(
      resolveCreationActorCompanyId({
        viewAsCompanyId: SUPPLIER,
        ownerId: OTHER_SUPPLIER,
      })
    ).toBe(SUPPLIER);
    expect(resolveCreationActorCompanyId({ ownerId: OTHER_SUPPLIER })).toBe(
      OTHER_SUPPLIER
    );
    expect(resolveCreationActorCompanyId({})).toBe("");
    expect(resolveCreationActorCompanyId({ ownerId: "null" })).toBe("");
  });
});
