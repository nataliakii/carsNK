/**
 * @jest-environment node
 */
import {
  buildTransferDetailsLines,
  buildPartnerOfferLines,
} from "../notifyTransferEmails";

const sample = {
  from: "SKG Airport",
  to: "Thessaloniki center",
  origin: { city: "Thessaloniki", locationType: "airport" },
  destination: { city: "Thessaloniki", locationType: "city" },
  distanceKm: 18,
  durationMinutes: 25,
  datetime: "2026-07-01T10:00:00.000Z",
  passengers: 2,
  customerName: "Jane Doe",
  phone: "+306900000000",
  email: "jane@example.com",
  notes: "Call on arrival",
  quoteSnapshot: {
    supplierPayoutMinor: 3500,
    currency: "EUR",
  },
};

describe("transfer email PII split", () => {
  test("partner lines omit phone, email, name and notes", () => {
    const lines = buildPartnerOfferLines(sample, "en");
    const joined = lines.join("\n");
    expect(joined).toContain("From:");
    expect(joined).toContain("To:");
    expect(joined).toContain("Distance:");
    expect(joined).toContain("When:");
    expect(joined).toContain("Passengers:");
    expect(joined).toContain("Supplier payout:");
    expect(joined).not.toMatch(/\+306900000000/);
    expect(joined).not.toMatch(/jane@example.com/i);
    expect(joined).not.toMatch(/Jane Doe/);
    expect(joined).not.toMatch(/Call on arrival/);
    expect(joined).not.toMatch(/Phone:/);
    expect(joined).not.toMatch(/Email:/);
  });

  test("includePii true keeps customer contact", () => {
    const lines = buildTransferDetailsLines(sample, {
      includePii: true,
      locale: "en",
    });
    const joined = lines.join("\n");
    expect(joined).toContain("Jane Doe");
    expect(joined).toContain("+306900000000");
    expect(joined).toContain("jane@example.com");
  });
});
