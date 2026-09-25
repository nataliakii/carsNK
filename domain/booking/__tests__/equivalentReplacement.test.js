import fs from "fs";
import path from "path";
import {
  evaluateEquivalentReplacement,
  replacementMayChargeBookingFee,
  verifyReplacementProposalSnapshot,
} from "@/domain/booking/equivalentReplacement";
import {
  equivalentReplacementDisclosure,
  equivalentReplacementPayCta,
  replacementAcceptanceOnVerifiedPayment,
  resolveReplacementSource,
  GUARANTEED_EQUIVALENT_MODEL,
  REPLACEMENT_SOURCE,
  REPLACEMENT_SOURCES,
} from "@/domain/booking/equivalentReplacementCopy";

/** Kinds that were merged away. Nothing may branch on them any more. */
const MERGED_AWAY = ["EXTERNAL_VEHICLE", "GUARANTEED_CLASS"];

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
    replacementSource: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
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

/** What the dialog sends when the supplier states no specification at all. */
function unspecified(overrides = {}) {
  return {
    replacementSource: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
    supplierMessage: "The booked car is in the workshop.",
    ...overrides,
  };
}

function filesUnder(dir) {
  const root = path.join(process.cwd(), dir);
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.name.endsWith(".js")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

describe("equivalent replacement kinds", () => {
  it("offers exactly two kinds: one fleet vehicle or one guaranteed equivalent", () => {
    expect(REPLACEMENT_SOURCES).toEqual([
      REPLACEMENT_SOURCE.COMPANY_VEHICLE,
      REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
    ]);
  });

  it("resolves both merged kinds, and nothing else, to the guaranteed equivalent", () => {
    for (const merged of MERGED_AWAY) {
      expect(resolveReplacementSource(merged)).toBe(
        REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT
      );
    }
    expect(resolveReplacementSource("company_vehicle")).toBe(
      REPLACEMENT_SOURCE.COMPANY_VEHICLE
    );
    for (const unknown of ["", null, undefined, "FLEET", "GUARANTEED"]) {
      expect(resolveReplacementSource(unknown)).toBe("");
    }
  });

  it("rejects a kind the rules do not define", () => {
    const result = evaluateEquivalentReplacement({
      original: original(),
      proposal: proposal({ replacementSource: "SOMETHING_ELSE" }),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("replacement_source");
  });

  it("no source file still branches on a merged-away kind", () => {
    const files = [
      ...filesUnder("domain/booking"),
      ...filesUnder("app/admin/features/orders"),
      ...filesUnder("app/api/admin/legal"),
      ...filesUnder("models"),
    ];
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const merged of MERGED_AWAY) {
        // The one legitimate mention is the map that resolves stored rows.
        const allowed = file.endsWith("equivalentReplacementCopy.js");
        expect(`${path.relative(process.cwd(), file)}:${source.includes(merged) && !allowed}`).toBe(
          `${path.relative(process.cwd(), file)}:false`
        );
      }
    }
  });
});

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

  it("rejects fewer seats and less luggage", () => {
    expect(
      evaluateEquivalentReplacement({
        original: original(),
        proposal: proposal({ seats: 2 }),
      }).code
    ).toBe("seats_downgrade");
    expect(
      evaluateEquivalentReplacement({
        original: original(),
        proposal: proposal({ luggage: 1 }),
      }).code
    ).toBe("luggage_downgrade");
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

describe("a guaranteed equivalent with no typed specifications", () => {
  it("still promises the original booking's own specification", () => {
    const result = evaluateEquivalentReplacement({
      original: original(),
      proposal: unspecified(),
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot.replacement).toMatchObject({
      model: GUARANTEED_EQUIVALENT_MODEL,
      class: "economy",
      transmission: "manual",
      seats: 4,
      luggage: 2,
    });
    expect(result.snapshot.totalPrice).toBe(200);
    expect(result.snapshot.guarantees).toMatchObject({
      classAtLeast: "economy",
      transmission: "manual",
      seatsAtLeast: 4,
      luggageAtLeast: 2,
      totalPriceAtMost: 200,
      datesUnchanged: true,
      locationsUnchanged: true,
      noSurcharge: true,
    });
    expect(result.snapshot.derivedFromOriginal).toEqual([
      "class",
      "luggage",
      "seats",
      "totalPrice",
      "transmission",
    ]);
  });

  it("records which promise was derived rather than stated", () => {
    const result = evaluateEquivalentReplacement({
      original: original(),
      proposal: unspecified({ category: "premium", seats: 5 }),
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot.replacement).toMatchObject({ class: "premium", seats: 5 });
    expect(result.snapshot.derivedFromOriginal).toEqual([
      "luggage",
      "totalPrice",
      "transmission",
    ]);
    // The floor is the original booking either way, never the typed value.
    expect(result.snapshot.guarantees.classAtLeast).toBe("economy");
    expect(result.snapshot.guarantees.seatsAtLeast).toBe(4);
  });

  it("never turns an empty price field into a cheaper or free rental", () => {
    for (const blank of ["", null, undefined, 0]) {
      const result = evaluateEquivalentReplacement({
        original: original(),
        proposal: unspecified({ totalPrice: blank }),
      });
      expect(result.ok).toBe(true);
      expect(result.snapshot.totalPrice).toBe(200);
    }
  });

  it("cannot be used to bypass a single guarantee by leaving fields empty", () => {
    const cases = [
      ["category_downgrade", { category: "mini" }],
      ["transmission_mismatch", { transmission: "automatic" }],
      ["seats_downgrade", { seats: 3 }],
      ["luggage_downgrade", { luggage: 0 }],
      ["price_increase", { totalPrice: 201 }],
      ["hidden_surcharge", { surcharge: 15 }],
      ["dates_changed", { rentalStartDate: "2026-10-02T10:00:00.000Z" }],
      ["location_changed", { placeIn: "Malaga Airport" }],
    ];
    for (const [code, override] of cases) {
      const result = evaluateEquivalentReplacement({
        original: original(),
        proposal: unspecified(override),
      });
      expect(`${code}:${result.ok}`).toBe(`${code}:false`);
      expect(result.code).toBe(code);
    }
  });

  it("fails closed rather than guessing a specification the booking never recorded", () => {
    expect(
      evaluateEquivalentReplacement({
        original: original({ category: "" }),
        proposal: unspecified(),
      }).code
    ).toBe("category_downgrade");
    expect(
      evaluateEquivalentReplacement({
        original: original({ transmission: "" }),
        proposal: unspecified(),
      }).code
    ).toBe("transmission_mismatch");
    expect(
      evaluateEquivalentReplacement({
        original: original({ seats: undefined }),
        proposal: unspecified(),
      }).code
    ).toBe("seats_downgrade");
    expect(
      evaluateEquivalentReplacement({
        original: original({ totalPrice: null }),
        proposal: unspecified(),
      }).code
    ).toBe("price_increase");
  });

  it("leaves luggage out of the promise when the booking does not record it", () => {
    const result = evaluateEquivalentReplacement({
      original: original({ luggage: undefined }),
      proposal: unspecified(),
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot.guarantees.luggageAtLeast).toBeNull();
    expect(result.snapshot.derivedFromOriginal).not.toContain("luggage");
  });

  it("checksums the derived promise so the accepted version stays auditable", () => {
    const { snapshot } = evaluateEquivalentReplacement({
      original: original(),
      proposal: unspecified(),
    });
    expect(verifyReplacementProposalSnapshot(snapshot).ok).toBe(true);
    const tampered = {
      ...snapshot,
      guarantees: { ...snapshot.guarantees, classAtLeast: "mini" },
    };
    expect(verifyReplacementProposalSnapshot(tampered)).toMatchObject({
      ok: false,
      code: "snapshot_mismatch",
    });
    const { checksum, ...stripped } = snapshot;
    expect(verifyReplacementProposalSnapshot(stripped)).toMatchObject({
      ok: false,
      code: "snapshot_mismatch",
    });
    expect(
      verifyReplacementProposalSnapshot(snapshot, { expectedChecksum: "another" })
    ).toMatchObject({ ok: false, code: "snapshot_mismatch" });
    expect(
      verifyReplacementProposalSnapshot(snapshot, { expectedChecksum: checksum }).ok
    ).toBe(true);
  });
});
