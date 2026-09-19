/**
 * @jest-environment node
 */
import {
  publicTransferSummary,
  redactUnclaimedPartnerPii,
} from "../claimTransfer";

describe("publicTransferSummary", () => {
  const doc = {
    _id: "cccccccccccccccccccccccc",
    from: "SKG",
    to: "City",
    distanceKm: 20,
    durationMinutes: 30,
    passengers: 2,
    datetime: "2026-07-01T10:00:00.000Z",
    customerName: "Jane Doe",
    phone: "+306911122233",
    email: "jane@example.com",
    notes: "secret note",
    status: "OPEN_FOR_CLAIM",
    quoteSnapshot: { supplierPayoutMinor: 4000, currency: "EUR" },
  };

  test("masks contact when revealContact is false", () => {
    const summary = publicTransferSummary(doc, { revealContact: false });
    expect(summary.email).toBe("");
    expect(summary.notes).toBe("");
    expect(summary.phone).toBe("");
    expect(summary.customerName).toBe("Available after claim");
    expect(JSON.stringify(summary)).not.toMatch(/Jane Doe/);
    expect(JSON.stringify(summary)).not.toMatch(/\+306911122233/);
    expect(JSON.stringify(summary)).not.toMatch(/jane@example.com/i);
    expect(JSON.stringify(summary)).not.toMatch(/secret note/);
  });

  test("reveals contact after claim", () => {
    const summary = publicTransferSummary(doc, { revealContact: true });
    expect(summary.phone).toBe(doc.phone);
    expect(summary.email).toBe(doc.email);
    expect(summary.customerName).toBe("Jane Doe");
    expect(summary.notes).toBe("secret note");
  });

  test("partner overlay keeps route cities and drops private pickup details", () => {
    const redacted = redactUnclaimedPartnerPii({
      ...doc,
      origin: {
        city: "Thessaloniki",
        locationType: "airport",
        formattedAddress: "12 Secret Street",
        hotelName: "Private Villa",
        lat: 40.5,
        lng: 23.0,
      },
      destination: {
        city: "Thessaloniki",
        locationType: "address",
        formattedAddress: "99 Hidden Ave",
      },
      communications: [{ channel: "sms", body: "call me" }],
    });
    expect(redacted.phone).toBe("");
    expect(redacted.email).toBe("");
    expect(redacted.notes).toBe("");
    expect(redacted.customerName).toBe("Available after claim");
    expect(redacted.origin).toEqual({
      city: "Thessaloniki",
      locationType: "airport",
      country: "",
    });
    expect(redacted.destination.formattedAddress).toBeUndefined();
    expect(redacted.communications).toEqual([]);
    expect(JSON.stringify(redacted)).not.toMatch(/Secret Street/);
    expect(JSON.stringify(redacted)).not.toMatch(/Private Villa/);
    expect(JSON.stringify(redacted)).not.toMatch(/call me/);
  });
});
