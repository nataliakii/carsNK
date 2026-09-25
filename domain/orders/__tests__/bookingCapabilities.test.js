/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { evaluateDrivingLicenceAccess } from "@/domain/legal/drivingLicenceAccess";
import {
  BOOKING_SOURCE,
  PLATFORM_WORKFLOW_STAGE,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  BOOKING_ROLE,
  assertBookingCapability,
  checkBookingFieldWrites,
  resolveActorCompanyId,
  resolveActorRole,
  resolveBookingCapabilities,
  resolveOrderCapabilities,
  PLATFORM_LOCKED_FIELDS,
} from "@/domain/orders/bookingCapabilities";
import { decideOrderUpdate } from "@/domain/booking/resolveBookingCapabilities";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = { isAdmin: true, role: 1, ownerId: OTHER_COMPANY };
const superadmin = { isAdmin: true, role: 2 };

function platform(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: COMPANY,
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    ...overrides,
  };
}

function caps(status, role = BOOKING_ROLE.ADMIN) {
  return resolveBookingCapabilities({
    source: BOOKING_SOURCE.PLATFORM,
    status,
    role,
    companyId: COMPANY,
    orderCompanyId: COMPANY,
  });
}

describe("new request — the supplier decides, and sees nothing private", () => {
  const newRequest = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION);

  test("exposes exactly confirm, replacement, decline and contact Rovaro", () => {
    const granted = Object.entries(newRequest)
      .filter(([, allowed]) => allowed)
      .map(([capability]) => capability)
      .sort();
    expect(granted).toEqual([
      BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE,
      BOOKING_CAPABILITY.CONTACT_ROVARO,
      BOOKING_CAPABILITY.DECLINE_REQUEST,
      BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT,
      BOOKING_CAPABILITY.VIEW_BOOKING,
    ].sort());
  });

  test("contacts and driving documents stay hidden", () => {
    expect(newRequest[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(false);
    expect(newRequest[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
    expect(newRequest[BOOKING_CAPABILITY.CONTACT_CUSTOMER]).toBe(false);
  });
});

describe("awaiting customer payment — the confirmation is irreversible", () => {
  const waiting = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT);

  test("the supplier cannot unconfirm, decline or offer another vehicle", () => {
    expect(waiting[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(false);
    expect(waiting[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(waiting[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(false);
  });

  test("Contact Rovaro is the only remaining action", () => {
    const granted = Object.entries(waiting)
      .filter(([, allowed]) => allowed)
      .map(([capability]) => capability)
      .sort();
    expect(granted).toEqual([
      BOOKING_CAPABILITY.CONTACT_ROVARO,
      BOOKING_CAPABILITY.VIEW_BOOKING,
    ].sort());
  });

  test("a submitted replacement proposal cannot be withdrawn either", () => {
    const proposed = caps(
      PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE
    );
    expect(proposed[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(false);
    expect(proposed[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(proposed[BOOKING_CAPABILITY.CONTACT_ROVARO]).toBe(true);
  });
});

describe("paid booking — read-only, but the supplier can finally reach the customer", () => {
  const paidOrder = platform({
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    confirmed: true,
    payment: { status: "paid" },
    returnAtUtc: "2026-10-01T10:00:00.000Z",
  });
  const now = new Date("2026-09-29T10:00:00.000Z");

  test("contacts and licence open only for the owning company", () => {
    const owning = resolveOrderCapabilities(paidOrder, companyAdmin, { now });
    expect(owning[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.CONTACT_CUSTOMER]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.REPORT_PROBLEM]).toBe(true);
  });

  test("another company gets nothing at all, not even the booking", () => {
    const stranger = resolveOrderCapabilities(paidOrder, otherCompanyAdmin, { now });
    expect(stranger[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(false);
    expect(stranger[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(false);
    expect(stranger[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
    expect(assertBookingCapability(stranger, BOOKING_CAPABILITY.VIEW_BOOKING)).toEqual({
      ok: false,
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    });
  });

  test("the booking stays read-only for the supplier", () => {
    const owning = resolveOrderCapabilities(paidOrder, companyAdmin, { now });
    expect(owning[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    expect(owning[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
    const writes = checkBookingFieldWrites({
      capabilities: owning,
      source: BOOKING_SOURCE.PLATFORM,
      fields: ["rentalEndDate", "totalPrice", "insurance", "ChildSeats", "placeOut"],
    });
    expect(writes.allowed).toBe(false);
    expect(writes.deniedFields.sort()).toEqual(
      ["ChildSeats", "insurance", "placeOut", "rentalEndDate", "totalPrice"].sort()
    );
  });

  test("the licence window closes again after the rental", () => {
    const late = resolveOrderCapabilities(paidOrder, companyAdmin, {
      now: new Date("2026-10-10T10:00:00.000Z"),
    });
    expect(late[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(true);
    expect(late[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
  });

  /**
   * The licence policy is owned by `domain/legal/drivingLicenceAccess.js`.
   * This pins the delegation so a second, quietly diverging rule cannot grow
   * inside the capability resolver.
   */
  test("VIEW_DRIVING_DOCUMENTS is exactly what the licence policy answers", () => {
    const cases = [
      { order: paidOrder, user: companyAdmin, now },
      { order: paidOrder, user: otherCompanyAdmin, now },
      { order: paidOrder, user: superadmin, now },
      { order: paidOrder, user: companyAdmin, now: new Date("2026-10-10T10:00:00.000Z") },
      { order: platform(), user: companyAdmin, now },
    ];

    for (const { order, user, now: at } of cases) {
      const policy = evaluateDrivingLicenceAccess({
        order,
        isSuperadmin: resolveActorRole(user) === BOOKING_ROLE.SUPERADMIN,
        sessionOwnerId: resolveActorCompanyId(user),
        now: at,
      });
      const granted =
        resolveOrderCapabilities(order, user, { now: at })[
          BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS
        ] === true;
      // A capability the resolver withholds for another reason may still be
      // false, but it must never exceed what the licence policy allows.
      if (!policy.allowed) expect(granted).toBe(false);
    }

    const resolver = fs.readFileSync(
      path.join(process.cwd(), "domain/orders/bookingCapabilities.js"),
      "utf8"
    );
    expect(resolver).toContain("evaluateDrivingLicenceAccess");
    // No hand-rolled window arithmetic next to the delegation.
    expect(resolver).not.toMatch(/ACCESS_WINDOW|getTime\(\)|60 \* 60 \* 1000/);
  });
});

describe("superadmin", () => {
  const order = platform({
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: { status: "paid" },
  });

  test("may amend under audit but never confirms the vehicle itself", () => {
    const able = resolveOrderCapabilities(order, superadmin);
    expect(able[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(true);
    expect(able[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(false);
    expect(able[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(able[BOOKING_CAPABILITY.CONTACT_ROVARO]).toBe(false);
  });

  test("a company admin never receives amendment powers", () => {
    const supplier = resolveOrderCapabilities(order, companyAdmin);
    expect(supplier[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
  });

  test("viewing the console as a company drops platform powers", () => {
    const viewingAs = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 2,
      viewAsCompanyId: COMPANY,
    });
    expect(viewingAs[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    expect(viewingAs[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(true);
  });
});

describe("the second driver is a platform extra", () => {
  const stages = [
    PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
    PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT,
    PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
  ];

  function internalCaps(actorCompany, bookingCompany, role = BOOKING_ROLE.ADMIN) {
    return resolveBookingCapabilities({
      source: BOOKING_SOURCE.INTERNAL,
      status: "",
      role,
      companyId: actorCompany,
      orderCompanyId: bookingCompany,
    });
  }

  test("no company admin can add it to a PLATFORM booking, at any stage", () => {
    for (const stage of stages) {
      const company = caps(stage);
      expect(company[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(false);
      expect(
        checkBookingFieldWrites({
          capabilities: company,
          source: BOOKING_SOURCE.PLATFORM,
          fields: ["secondDriver"],
        }).allowed
      ).toBe(false);
    }
  });

  test("a company admin can add it to an INTERNAL booking it owns", () => {
    const internal = internalCaps(COMPANY, COMPANY);
    expect(internal[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(true);
    expect(internal[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(true);
    expect(
      checkBookingFieldWrites({
        capabilities: internal,
        source: BOOKING_SOURCE.INTERNAL,
        fields: ["secondDriver"],
      }).allowed
    ).toBe(true);
  });

  test("a company admin cannot add it to another company's INTERNAL booking", () => {
    const foreign = internalCaps(OTHER_COMPANY, COMPANY);
    expect(foreign[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(false);
    expect(foreign[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(false);
    expect(
      checkBookingFieldWrites({
        capabilities: foreign,
        source: BOOKING_SOURCE.INTERNAL,
        fields: ["secondDriver"],
      }).allowed
    ).toBe(false);
  });

  test("a superadmin can, on both sources", () => {
    const platformCaps = caps(
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
      BOOKING_ROLE.SUPERADMIN
    );
    expect(platformCaps[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(true);
    expect(
      checkBookingFieldWrites({
        capabilities: platformCaps,
        source: BOOKING_SOURCE.PLATFORM,
        fields: ["secondDriver"],
      }).allowed
    ).toBe(true);

    const internal = internalCaps(null, COMPANY, BOOKING_ROLE.SUPERADMIN);
    expect(internal[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(true);
    // Rovaro adds the extra but still does not take over the company's own
    // editing flow.
    expect(internal[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
  });
});

describe("the update route enforces the second-driver rule by source", () => {
  function internalOrder(overrides = {}) {
    return {
      _id: "64a0000000000000000000bb",
      source: BOOKING_SOURCE.INTERNAL,
      my_order: false,
      ownerId: COMPANY,
      ...overrides,
    };
  }

  test("a company admin adding it to a PLATFORM booking is refused with 403", () => {
    const decision = decideOrderUpdate({
      order: platform(),
      user: companyAdmin,
      payload: { secondDriver: true },
    });
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.code).toBe("CAPABILITY_DENIED");
    expect(decision.fields).toEqual(["secondDriver"]);
  });

  test("the owning company admin may add it to its own INTERNAL booking", () => {
    const decision = decideOrderUpdate({
      order: internalOrder(),
      user: companyAdmin,
      payload: { secondDriver: true },
    });
    expect(decision.ok).toBe(true);
  });

  test("another company is refused on an INTERNAL booking too", () => {
    const decision = decideOrderUpdate({
      order: internalOrder(),
      user: otherCompanyAdmin,
      payload: { secondDriver: true },
    });
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.code).toBe("CAPABILITY_DENIED");
  });

  test("another company is refused on a PLATFORM booking too", () => {
    const decision = decideOrderUpdate({
      order: platform(),
      user: otherCompanyAdmin,
      payload: { timeOut: "2026-02-01T10:00:00.000Z" },
    });
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe(403);
  });

  test("a superadmin may add it on either source", () => {
    expect(
      decideOrderUpdate({
        order: internalOrder(),
        user: superadmin,
        payload: { secondDriver: true },
      }).ok
    ).toBe(true);
    // On a platform booking this is a material change, so it travels through
    // the audited amendment path rather than a bare field write, and the
    // acting user has to be identifiable.
    const onPlatform = decideOrderUpdate({
      order: platform(),
      user: { ...superadmin, id: "64a00000000000000000000f", email: "ops@rovaro.com" },
      payload: {
        secondDriver: true,
        amendmentReason: "Customer asked to add a second driver",
        amendmentRequestedBy: "CUSTOMER",
      },
    });
    expect(onPlatform.ok).toBe(true);
    expect(onPlatform.audit.fieldsChanged).toContain("secondDriver");
  });
});

describe("INTERNAL controls never leak onto a PLATFORM booking", () => {
  test("a company admin gets no edit capability on any platform stage", () => {
    for (const stage of Object.values(PLATFORM_WORKFLOW_STAGE)) {
      const granted = caps(stage);
      expect(granted[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
      expect(granted[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    }
  });

  test("every platform-locked field is refused even when the UI is bypassed", () => {
    const granted = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION);
    const writes = checkBookingFieldWrites({
      capabilities: granted,
      source: BOOKING_SOURCE.PLATFORM,
      fields: [...PLATFORM_LOCKED_FIELDS],
    });
    expect(writes.allowed).toBe(false);
    expect(writes.deniedFields.sort()).toEqual([...PLATFORM_LOCKED_FIELDS].sort());
    expect(writes.code).toBe("PLATFORM_BOOKING_READ_ONLY");
  });

  test("an unclassified record grants nothing until it is reviewed", () => {
    const ambiguous = resolveBookingCapabilities({
      source: "",
      status: PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
      role: BOOKING_ROLE.SUPERADMIN,
      companyId: COMPANY,
      orderCompanyId: COMPANY,
    });
    expect(ambiguous[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(false);
  });
});
