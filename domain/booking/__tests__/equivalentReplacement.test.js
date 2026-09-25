import fs from "fs";
import path from "path";
import {
  evaluateEquivalentReplacement,
  replacementMayChargeBookingFee,
} from "@/domain/booking/equivalentReplacement";
import {
  equivalentReplacementDisclosure,
  equivalentReplacementPayCta,
  replacementAcceptanceOnVerifiedPayment,
} from "@/domain/booking/equivalentReplacementCopy";

function original(overrides = {}) {
  return {
    model: "Fiat Panda",
    category: "economy",
    transmission: "manual",
    seats: 4,
    luggage: 2,
    totalPrice: 200,
    rentalStartDate: "2026-10-01T10:00:00.000Z",
    rentalEndDate: "2026-10-05T10:00:00.000Z",
    placeIn: "Athens Airport",
    placeOut: "Athens Airport",
    ...overrides,
  };
}

function proposal(overrides = {}) {
  return {
    replacementSource: "EXTERNAL_VEHICLE",
    model: "Toyota Yaris",
    category: "economy",
    transmission: "manual",
    seats: 5,
    luggage: 2,
    totalPrice: 200,
    supplierMessage: "The booked car is in the workshop.",
    ...overrides,
  };
}

describe("equivalent replacement before payment", () => {
  it("rejects a different transmission", () => {
    const result = evaluateEquivalentReplacement({
      original: original(),
      proposal: proposal({ transmission: "automatic" }),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("transmission_mismatch");
  });

  it("rejects a higher price", () => {
    const result = evaluateEquivalentReplacement({
      original: original(),
      proposal: proposal({ totalPrice: 210 }),
    });
    expect(result.code).toBe("price_increase");
  });

  it("rejects a lower class", () => {
    const result = evaluateEquivalentReplacement({
      original: original({ category: "suv" }),
      proposal: proposal({ category: "economy" }),
    });
    expect(result.code).toBe("category_downgrade");
  });

  it("stays unpaid until the customer accepts the disclosed offer", () => {
    expect(replacementMayChargeBookingFee({ acceptedByCustomer: false, disclosureShown: true })).toBe(
      false
    );
    expect(replacementMayChargeBookingFee({ acceptedByCustomer: true, disclosureShown: false })).toBe(
      false
    );
    expect(replacementMayChargeBookingFee({ acceptedByCustomer: true, disclosureShown: true })).toBe(
      true
    );
  });

  it("records proposal acceptance only from the verified payment", () => {
    const paidAt = new Date("2026-10-01T12:00:00.000Z");
    expect(replacementAcceptanceOnVerifiedPayment({}, paidAt)).toEqual({});
    expect(
      replacementAcceptanceOnVerifiedPayment(
        { pendingReplacementProposal: { checksum: "abc", version: 1, offerId: "off-1" } },
        paidAt
      )
    ).toMatchObject({
      replacementProposalAcceptedChecksum: "abc",
      replacementProposalAcceptedVersion: 1,
      replacementProposalAcceptedOfferId: "off-1",
      replacementProposalAcceptedAt: paidAt,
    });
    const checkout = fs.readFileSync(
      path.join(process.cwd(), "domain/orders/rentalStripeCheckout.js"),
      "utf8"
    );
    expect(checkout).toContain("replacementAcceptanceOnVerifiedPayment");
    expect(checkout).toContain("BOOKING_CONFIRMED");
  });

  it("states the guaranteed replacement in the customer copy", () => {
    expect(
      equivalentReplacementDisclosure({
        vehicle: "Fiat Panda",
        transmission: "manual",
        seats: 4,
      })
    ).toBe(
      "The originally requested Fiat Panda is unavailable. The supplier offers a guaranteed vehicle of the same or a higher class, with manual transmission, at least 4 seats, for the same total rental price. The exact make and model may differ."
    );
    expect(equivalentReplacementPayCta("€20.00")).toBe("Accept replacement and pay €20.00");
  });

  it("keeps Confirmed by Rovaro out of the contractor order UI", () => {
    const root = process.cwd();
    const files = [
      "app/admin/features/orders/components/SupplierResponseCell.js",
      "app/admin/features/orders/components/CustomerConfirmationCell.js",
      "app/admin/features/orders/OrdersTableSection.js",
      "locales/en.json",
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), "utf8").toLowerCase();
      expect(text).not.toContain("confirmed by rovaro");
      expect(text).not.toContain("rovaro approved");
    }
  });
});
