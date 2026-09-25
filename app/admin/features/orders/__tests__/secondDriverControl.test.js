/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { useEditOrderPermissions } from "@/app/admin/features/orders/hooks/useEditOrderPermissions";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = { isAdmin: true, role: 1, ownerId: OTHER_COMPANY };
const superadmin = { isAdmin: true, role: 2 };

/** An open edit window, so only the source rule can close the control. */
const OPEN_ACCESS = {
  canEdit: true,
  canDelete: true,
  canConfirm: true,
  canEditPickupDate: true,
  canEditReturnDate: true,
  canEditPickupPlace: true,
  canEditReturn: true,
  canEditInsurance: true,
  canEditFranchise: true,
  canEditPricing: true,
  canEditTotalPrice: true,
  canEditClientPII: true,
  isViewOnly: false,
  isPast: false,
  timeBucket: "CURRENT",
};

const internalOrder = (ownerId = COMPANY) => ({
  _id: "64a0000000000000000000bb",
  source: BOOKING_SOURCE.INTERNAL,
  my_order: false,
  ownerId,
});

const platformOrder = (ownerId = COMPANY) => ({
  _id: "64a0000000000000000000aa",
  source: BOOKING_SOURCE.PLATFORM,
  my_order: true,
  ownerId,
  bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
  bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
});

/** Runs the hook for real rather than restating what it should return. */
function permissionsFor(order, user, access = OPEN_ACCESS) {
  let captured = null;
  function Probe() {
    captured = useEditOrderPermissions(order, user, false, access);
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return captured;
}

describe("the second-driver control follows the booking source", () => {
  test("it is available in the INTERNAL editing flow for the owning company", () => {
    const permissions = permissionsFor(internalOrder(), companyAdmin);
    expect(permissions.fieldPermissions.secondDriver).toBe(true);
    expect(permissions.canEditField("secondDriver")).toBe(true);
  });

  test("it is absent for a company admin on a PLATFORM booking", () => {
    const permissions = permissionsFor(platformOrder(), companyAdmin);
    expect(permissions.fieldPermissions.secondDriver).toBe(false);
    // The rest of the edit window is untouched by this rule.
    expect(permissions.canEdit).toBe(true);
  });

  test("it is absent on another company's INTERNAL booking", () => {
    const permissions = permissionsFor(internalOrder(COMPANY), otherCompanyAdmin);
    expect(permissions.fieldPermissions.secondDriver).toBe(false);
  });

  test("a superadmin keeps it on both sources", () => {
    expect(
      permissionsFor(platformOrder(), superadmin).fieldPermissions.secondDriver
    ).toBe(true);
    expect(
      permissionsFor(internalOrder(), superadmin).fieldPermissions.secondDriver
    ).toBe(true);
  });

  test("a closed edit window still wins over the source rule", () => {
    const permissions = permissionsFor(internalOrder(), companyAdmin, {
      ...OPEN_ACCESS,
      canEdit: false,
      isViewOnly: true,
    });
    expect(permissions.fieldPermissions.secondDriver).toBe(false);
  });

  test("the hook asks the shared resolver instead of restating the rule", () => {
    const hook = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/admin/features/orders/hooks/useEditOrderPermissions.js"
      ),
      "utf8"
    );
    expect(hook).toContain("resolveOrderCapabilities");
    expect(hook).toContain("BOOKING_CAPABILITY.ADD_SECOND_DRIVER");
  });

  test("the platform modal shows the second driver as a fact, not a control", () => {
    const modal = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/admin/features/orders/modals/BookingDetailsModal.js"
      ),
      "utf8"
    );
    expect(modal).toContain("bookingDetails.options.secondDriver");
    expect(modal).not.toMatch(/secondDriver.*onChange/);
    expect(modal).not.toContain("Checkbox");
    expect(modal).not.toContain("Switch");
  });

  test("the INTERNAL modal keeps its checkbox behind the same permission", () => {
    const modal = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/admin/features/orders/modals/EditOrderModal.js"
      ),
      "utf8"
    );
    expect(modal).toContain("permissions.fieldPermissions.secondDriver");
    expect(modal).toContain('updateField("secondDriver"');
  });
});
