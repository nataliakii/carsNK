/**
 * @jest-environment node
 *
 * The public submission filter is an allow-list, and these tests exist to keep
 * it one. A deny-list fails open: the next admin-only field someone adds would
 * be reachable from a public POST in exactly the way adminPriceOverrideMinor was.
 */
import fs from "node:fs";
import path from "node:path";

import {
  ADMIN_ONLY_TRANSFER_FIELDS,
  ADMIN_ONLY_TRANSFER_KEYS,
  MAX_PUBLIC_ADDITIONAL_STOPS,
  PUBLIC_ADDITIONAL_STOP_FIELDS,
  PUBLIC_LOCATION_FIELDS,
  PUBLIC_TRANSFER_FIELDS,
  SERVER_COMPUTED_TRANSFER_FIELDS,
  adminOverrideFromTrustedBody,
  pickPublicTransferPayload,
} from "../transferPayloadPolicy";

const CREATE_ORDER_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "domain/transfers/createTransferOrder.js"),
  "utf8"
);

function validSubmission(overrides = {}) {
  return {
    from: "Barcelona Airport",
    to: "Sitges",
    datetime: "2030-06-01T10:00",
    adults: 2,
    email: "traveller@example.com",
    ...overrides,
  };
}

describe("pickPublicTransferPayload", () => {
  test("keeps the fields a customer legitimately fills in", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        notes: "Two large cases",
        childSeats: 1,
        origin: { placeName: "Barcelona Airport", city: "Barcelona" },
      })
    );

    expect(safe.from).toBe("Barcelona Airport");
    expect(safe.to).toBe("Sitges");
    expect(safe.email).toBe("traveller@example.com");
    expect(safe.notes).toBe("Two large cases");
    expect(safe.childSeats).toBe(1);
    expect(safe.origin).toEqual({
      placeName: "Barcelona Airport",
      city: "Barcelona",
    });
  });

  test("drops client-computed distance, duration and money", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        distanceKm: 999,
        durationMinutes: 1,
        baseFromDistanceKm: 50,
        baseFromDurationMinutes: 12,
        baseToDistanceKm: 40,
        baseToDurationMinutes: 10,
        quoteSnapshot: { customerPriceMinor: 1 },
        customerPriceMinor: 1,
        supplierPayoutMinor: 1,
      })
    );

    for (const field of SERVER_COMPUTED_TRANSFER_FIELDS) {
      expect(safe[field]).toBeUndefined();
    }
  });

  test("drops every declared admin-only field", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        adminPriceOverrideMinor: 1,
        adminSupplierPayoutMinor: 999999,
        adminOverrideReason: "because I said so",
        createdByAdmin: true,
      })
    );

    for (const field of ADMIN_ONLY_TRANSFER_FIELDS) {
      expect(safe[field]).toBeUndefined();
    }
  });

  test("drops an unknown field, so a future admin-only field is safe by default", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        adminDiscountMinor: -5000,
        adminCompanyId: "company-1",
        status: "PAID",
        bookingStatus: "CONFIRMED",
        assignedSupplierId: "company-1",
        claimedByCompanyId: "company-1",
        platformCommissionPercent: 0,
        internalNotes: "injected",
        payment: { status: "paid", amountMinor: 0 },
        currency: "XXX",
        appliedDiscounts: [{ amountMinor: 10000 }],
        offerExpiresAt: "2099-01-01",
        isHoliday: false,
        __proto__: { polluted: true },
      })
    );

    expect(Object.keys(safe).sort()).toEqual(
      Object.keys(safe)
        .filter((key) => PUBLIC_TRANSFER_FIELDS.includes(key))
        .sort()
    );
    expect(safe.adminDiscountMinor).toBeUndefined();
    expect(safe.status).toBeUndefined();
    expect(safe.payment).toBeUndefined();
    expect(safe.currency).toBeUndefined();
    expect(safe.polluted).toBeUndefined();
  });

  test("filters nested locations too, so nothing hides in a subdocument", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        origin: {
          placeName: "Barcelona Airport",
          city: "Barcelona",
          capturedAt: "1999-01-01",
          adminPriceOverrideMinor: 1,
          customerPriceMinor: 1,
        },
        destination: { placeName: "Sitges", internalNotes: "injected" },
      })
    );

    expect(Object.keys(safe.origin).every((k) => PUBLIC_LOCATION_FIELDS.includes(k))).toBe(
      true
    );
    expect(safe.origin.capturedAt).toBeUndefined();
    expect(safe.origin.adminPriceOverrideMinor).toBeUndefined();
    expect(safe.destination.internalNotes).toBeUndefined();
  });

  test("filters children, special luggage and additional stops", () => {
    const safe = pickPublicTransferPayload(
      validSubmission({
        children: [{ age: 4, adminPriceOverrideMinor: 1 }],
        specialLuggage: [{ type: "skis", quantity: 1, amountMinor: 0 }],
        additionalStops: [
          {
            location: { placeName: "Vilanova", adminOverrideReason: "x" },
            notes: "quick stop",
            surchargeMinor: 0,
          },
        ],
      })
    );

    expect(safe.children).toEqual([{ age: 4 }]);
    expect(safe.specialLuggage).toEqual([{ type: "skis", quantity: 1 }]);
    expect(Object.keys(safe.additionalStops[0]).every((k) =>
      PUBLIC_ADDITIONAL_STOP_FIELDS.includes(k)
    )).toBe(true);
    expect(safe.additionalStops[0].location).toEqual({ placeName: "Vilanova" });
  });

  test("keeps one stop over the cap so the caller is refused, not silently trimmed", () => {
    const stops = Array.from({ length: 50 }, (_, i) => ({ notes: `stop ${i}` }));
    const safe = pickPublicTransferPayload(validSubmission({ additionalStops: stops }));

    expect(safe.additionalStops.length).toBe(MAX_PUBLIC_ADDITIONAL_STOPS + 1);
  });

  test("a non-object body yields nothing rather than throwing", () => {
    expect(pickPublicTransferPayload(null)).toEqual({});
    expect(pickPublicTransferPayload("from=A")).toEqual({});
    expect(pickPublicTransferPayload([{ from: "A" }])).toEqual({});
  });
});

describe("the declared field sets stay consistent", () => {
  test("no admin-only or server-computed field is on the public allow-list", () => {
    for (const field of [
      ...ADMIN_ONLY_TRANSFER_FIELDS,
      ...SERVER_COMPUTED_TRANSFER_FIELDS,
    ]) {
      expect(PUBLIC_TRANSFER_FIELDS).not.toContain(field);
    }
  });

  test("every payload field createTransferOrder reads is declared somewhere", () => {
    const declared = new Set([
      ...PUBLIC_TRANSFER_FIELDS,
      ...ADMIN_ONLY_TRANSFER_FIELDS,
      ...SERVER_COMPUTED_TRANSFER_FIELDS,
    ]);
    const read = new Set(
      [...CREATE_ORDER_SOURCE.matchAll(/payload\??\.([A-Za-z0-9_]+)/g)].map(
        (match) => match[1]
      )
    );

    expect(read.size).toBeGreaterThan(20);
    expect([...read].filter((field) => !declared.has(field))).toEqual([]);
  });

  test("createTransferOrder never reads an admin-only field from the payload", () => {
    for (const field of ADMIN_ONLY_TRANSFER_FIELDS) {
      expect(CREATE_ORDER_SOURCE).not.toContain(`payload.${field}`);
      expect(CREATE_ORDER_SOURCE).not.toContain(`payload?.${field}`);
    }
  });
});

describe("adminOverrideFromTrustedBody", () => {
  test("reads the declared admin keys", () => {
    const override = adminOverrideFromTrustedBody({
      [ADMIN_ONLY_TRANSFER_KEYS.priceOverrideMinor]: 7500,
      [ADMIN_ONLY_TRANSFER_KEYS.supplierPayoutMinor]: 6000,
      [ADMIN_ONLY_TRANSFER_KEYS.overrideReason]: "Agreed with the partner",
    });

    expect(override).toEqual({
      customerPriceMinor: 7500,
      supplierPayoutMinor: 6000,
      reason: "Agreed with the partner",
    });
  });

  test("a price without a reason is not an override", () => {
    expect(adminOverrideFromTrustedBody({ adminPriceOverrideMinor: 1 })).toBeNull();
    expect(
      adminOverrideFromTrustedBody({
        adminPriceOverrideMinor: 1,
        adminOverrideReason: "   ",
      })
    ).toBeNull();
  });

  test("a negative or unparseable price is refused", () => {
    expect(
      adminOverrideFromTrustedBody({
        adminPriceOverrideMinor: -1,
        adminOverrideReason: "typo",
      })
    ).toBeNull();
    expect(
      adminOverrideFromTrustedBody({
        adminPriceOverrideMinor: "free",
        adminOverrideReason: "typo",
      })
    ).toBeNull();
  });
});
