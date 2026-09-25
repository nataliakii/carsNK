/**
 * @jest-environment node
 */

process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
process.env.NEXT_PUBLIC_SITE_URL = "https://rovaro.autos";

import { buildSupplierNewBookingEmail } from "@/domain/mail/supplierNewBookingEmail";

const ORDER_ID = "507f1f77bcf86cd799439011";
const REVIEW_URL = `https://rovaro.autos/admin/orders?orderId=${ORDER_ID}`;

function visibleText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) => anchor.replace(/<[^>]+>/g, ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bookingUrls(value) {
  return String(value || "").match(/\/admin\/orders\?orderId=[^"'\s<]+/g) || [];
}

describe("supplier new booking email", () => {
  const mail = buildSupplierNewBookingEmail({
    orderId: ORDER_ID,
    orderNumber: "20260925134903",
    carModel: "Audi",
    pickupAt: "2026-09-21T10:00:00.000Z",
    returnAt: "2026-09-24T18:30:00.000Z",
    timezone: "UTC",
    pickupLocation: "QA Office A, Barcelona",
    returnLocation: "QA Office A, Barcelona",
    pickup:
      "Office pickup: QA Office A https://maps.google.com/maps?q=41.39,2.16 · €0",
    customerName: "Natalia",
    phone: "+34600000000",
    email: "natalia@example.com",
    totalFormatted: "EUR 165.00",
    remainingFormatted: "EUR 146.85",
    confirmUrl:
      "https://rovaro.autos/api/booking/partner-confirm?token=eyJhbGciOiJIUzI1NiJ9.raw-token",
  });

  test("subject, summary, and one canonical review URL", () => {
    expect(mail.subject).toBe("New booking request — Audi, 21–24 Sep 2026");
    expect(mail.text).toContain("New booking request");
    expect(mail.text).toContain("Please confirm whether you can provide this vehicle.");
    expect(mail.text).toContain("Vehicle: Audi");
    expect(mail.text).toContain("Pickup: 21 Sep 2026, 10:00");
    expect(mail.text).toContain("Return: 24 Sep 2026, 18:30");
    expect(mail.text).toContain("Pickup location: QA Office A, Barcelona");
    expect(mail.text).toContain("Total rental price: EUR 165.00");
    expect(mail.text).toContain("You collect from the customer: EUR 146.85");
    expect(mail.text).toContain(
      "Customer contact details and driving documents will become available after the Rovaro Booking Fee is paid."
    );
    expect(mail.text).toContain("Please respond as soon as possible.");
    expect(mail.text.trim().endsWith("Booking #20260925134903")).toBe(true);
    expect(bookingUrls(mail.text)).toEqual([
      `/admin/orders?orderId=${ORDER_ID}`,
    ]);
    expect(bookingUrls(mail.html)).toEqual([
      `/admin/orders?orderId=${ORDER_ID}`,
    ]);
    expect(mail.html).toContain(`href="${REVIEW_URL}"`);
    expect(mail.html).toContain("Review booking request");
  });

  test("has no confirmation token, customer identity, or visible long URL", () => {
    const combined = `${mail.subject}\n${mail.text}\n${mail.html}`;
    expect(combined).not.toMatch(/partner-confirm/i);
    expect(combined).not.toMatch(/token=/i);
    expect(combined).not.toMatch(/maps\.google|google\.com\/maps/i);
    expect(combined).not.toContain("+34600000000");
    expect(combined).not.toContain("natalia@example.com");
    expect(combined).not.toContain("Natalia");
    expect(combined).not.toMatch(/Confirmed by Rovaro|Rovaro approval|Confirm booking by email/i);
    expect(mail.text.match(new RegExp(`Booking #20260925134903`, "g"))).toHaveLength(1);
    expect(visibleText(mail.html)).not.toMatch(/https?:\/\//);
    expect(visibleText(mail.html)).not.toMatch(/partner-confirm|token=/);
    expect(visibleText(mail.html)).toContain("Review booking request");
    expect(visibleText(mail.html)).toContain("Booking #20260925134903");
  });

  test("uses the Rovaro black header, magenta CTA, and wordmark", () => {
    expect(mail.html).toContain("background-color:#0A0A0A");
    expect(mail.html).toContain("#E9004F");
    expect(mail.html).toContain("/brand/rovaro/wordmark");
    expect(mail.html).not.toContain("#008989");
    expect(mail.html).toContain("max-width:600px");
    expect(mail.html).toContain("@media only screen and (max-width: 600px)");
  });
});
