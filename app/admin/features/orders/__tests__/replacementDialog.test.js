/**
 * The replacement dialog a supplier actually fills in.
 *
 * Three things were wrong with it: it offered two options that meant the same
 * promise, it collected specifications as free text, and it never showed the
 * vehicle the proposal has to match. These hold that shut.
 */

import fs from "node:fs";
import path from "node:path";

import { REPLACEMENT_SOURCE } from "@/domain/booking/equivalentReplacementCopy";
import {
  REPLACEMENT_KIND,
  REPLACEMENT_KINDS,
} from "@/app/admin/features/orders/actions/bookingDetailsActions";

const read = (relative) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

const MODAL = read("app/admin/features/orders/modals/BookingDetailsModal.js");
const ROUTE = read("app/api/admin/legal/alternative-offers/route.js");

/** The replace dialog only, so an assertion cannot pass on another dialog. */
const REPLACE_DIALOG = MODAL.slice(
  MODAL.indexOf('dialog === "replace"'),
  MODAL.indexOf('dialog === "amend"')
);

describe("the replacement dialog", () => {
  it("shares the domain enum instead of restating the kinds", () => {
    expect(REPLACEMENT_KIND).toBe(REPLACEMENT_SOURCE);
    expect(REPLACEMENT_KINDS).toHaveLength(2);
    expect(MODAL).toContain("Object.values(REPLACEMENT_KIND)");
  });

  it("shows the originally requested vehicle beside the proposal", () => {
    expect(REPLACE_DIALOG).toContain('data-testid="replacement-requested-vehicle"');
    expect(REPLACE_DIALOG).toContain("bookingDetails.replacement.originallyRequested");
    for (const key of [
      "bookingDetails.vehicle.requested",
      "bookingDetails.vehicle.class",
      "bookingDetails.vehicle.transmission",
      "bookingDetails.vehicle.seats",
      "bookingDetails.vehicle.luggage",
      "bookingDetails.price.totalRentalPrice",
    ]) {
      expect(REPLACE_DIALOG).toContain(key);
    }
    expect(REPLACE_DIALOG).toContain("<PriceTag");
  });

  it("spells out what the supplier is committing to", () => {
    expect(REPLACE_DIALOG).toContain('data-testid="replacement-guarantee"');
    for (const key of [
      "bookingDetails.replacementDialog.guaranteeClass",
      "bookingDetails.replacementDialog.guaranteeTransmission",
      "bookingDetails.replacementDialog.guaranteeSeats",
      "bookingDetails.replacementDialog.guaranteePrice",
    ]) {
      expect(REPLACE_DIALOG).toContain(key);
    }
  });

  it("collects class, transmission, seats and luggage as filtered dropdowns", () => {
    expect(REPLACE_DIALOG).toContain("REPLACEMENT_SPEC_FIELDS.map");
    expect(REPLACE_DIALOG).toContain("field.optionsFor(requestedVehicle)");
    expect(REPLACE_DIALOG).toContain("bookingDetails.replacementDialog.asRequested");
    for (const builder of [
      "replacementClassOptions",
      "replacementTransmissionOptions",
      "replacementSeatOptions",
      "replacementLuggageOptions",
    ]) {
      expect(MODAL).toContain(builder);
    }
    // No free-text or number box is left for a value with a fixed vocabulary.
    expect(REPLACE_DIALOG).not.toContain('type="number"');
  });

  it("asks for nothing but a comment on the guaranteed path", () => {
    expect(MODAL).toContain("bookingDetails.replacementDialog.optionalIntro");
    expect(MODAL).toMatch(
      /replacementReady =\s*\n?\s*replacement\.supplierMessage\.trim\(\)\.length > 0/
    );
    // The price is derived from the booking, so it is not a field any more.
    expect(MODAL).not.toContain("replacementDialog.totalPrice");
  });

  it("refuses to send a promise the booking cannot support", () => {
    expect(MODAL).toContain("canGuaranteeEquivalent(requestedVehicle)");
    expect(REPLACE_DIALOG).toContain(
      "bookingDetails.replacementDialog.guaranteeUnavailable"
    );
  });

  it("is the only place a replacement proposal is composed", () => {
    for (const file of [
      "app/admin/features/orders/components/SupplierResponseCell.js",
      "app/admin/features/orders/OrdersTableSection.js",
    ]) {
      expect(read(file)).not.toContain("replacementSource");
    }
  });

  it("branches the API route on the resolved kind, not on a literal", () => {
    expect(ROUTE).toContain("resolveReplacementSource(body?.replacementSource)");
    expect(ROUTE).toContain("REPLACEMENT_SOURCE.COMPANY_VEHICLE");
    expect(ROUTE).not.toMatch(/"COMPANY_VEHICLE"/);
  });
});
