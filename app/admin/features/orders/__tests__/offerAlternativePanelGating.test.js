/**
 * @jest-environment node
 *
 * The replacement-offer card reached an internal booking because it gated on
 * booking mode, which says how the record was taken, instead of booking
 * source, which says whether Rovaro mediates it. These tests hold the panel to
 * the canonical capability resolver.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import OfferAlternativePanel from "@/app/admin/features/orders/OfferAlternativePanel";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = { isAdmin: true, role: 1, ownerId: OTHER_COMPANY };

function order(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    ownerId: COMPANY,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    ...overrides,
  };
}

const internal = (overrides = {}) =>
  order({ source: BOOKING_SOURCE.INTERNAL, my_order: false, ...overrides });

const platform = (overrides = {}) =>
  order({
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    ...overrides,
  });

const render = (props) =>
  renderToStaticMarkup(<OfferAlternativePanel {...props} />);

describe("OfferAlternativePanel gating", () => {
  test("renders nothing on an internal booking", () => {
    expect(render({ order: internal(), currentUser: companyAdmin })).toBe("");
  });

  test("renders nothing on an internal booking carrying a marketplace mode", () => {
    // The exact record shape that produced the reported bug.
    const leaky = internal({ bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST });
    expect(render({ order: leaky, currentUser: companyAdmin })).toBe("");
  });

  test("stays hidden on an internal booking for the superadmin too", () => {
    expect(
      render({
        order: internal({ bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST }),
        currentUser: { isAdmin: true, role: 2 },
        isSuperAdmin: true,
      })
    ).toBe("");
  });

  test("renders for the owning company on a platform request awaiting its decision", () => {
    const markup = render({ order: platform(), currentUser: companyAdmin });
    expect(markup).toContain("Offer alternative vehicle");
  });

  test("renders nothing for another company's platform booking", () => {
    expect(render({ order: platform(), currentUser: otherCompanyAdmin })).toBe(
      ""
    );
  });

  test("renders nothing once the platform booking is no longer awaiting a decision", () => {
    const paid = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
    });
    expect(render({ order: paid, currentUser: companyAdmin })).toBe("");
  });
});
