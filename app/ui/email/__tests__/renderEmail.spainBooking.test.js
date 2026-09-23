import { renderCustomerOrderConfirmationEmail } from "@/app/ui/email/renderEmail";

describe("customer booking confirmation email — Spain fields", () => {
  test("includes address details and no payment CTA on marketplace create", () => {
    const result = renderCustomerOrderConfirmationEmail({
      locale: "es",
      action: "CREATE",
      bookingMode: "MARKETPLACE_REQUEST",
      orderId: "order-es",
      orderNumber: "20260921120000",
      carNumber: "001",
      regNumber: "1234ABC",
      carModel: "Seat Leon",
      rentalStartDate: "2026-09-21T10:00:00.000Z",
      rentalEndDate: "2026-09-24T10:00:00.000Z",
      timeIn: "2026-09-21T10:00:00.000Z",
      timeOut: "2026-09-24T08:00:00.000Z",
      timezone: "Europe/Madrid",
      placeIn: "Barcelona",
      placeInDetail: "Hotel Arts, Carrer de la Marina 19",
      pickupMethod: "delivery",
      placeOut: "Office Centro",
      placeOutDetail: "Carrer Provença 1",
      returnMethod: "office",
      numberOfDays: 3,
      ChildSeats: 1,
      insurance: "CDW",
      franchiseOrder: 300,
      totalPrice: 240,
      customerName: "Ana",
    });

    expect(result.html).toContain("Hotel Arts, Carrer de la Marina 19");
    expect(result.html).toContain("Carrer Provença 1");
    expect(result.html).not.toContain("checkout.stripe.com");
    expect(result.html).not.toContain("Pay the booking prepayment");
    expect(result.html).toContain("CDW");
    expect(result.text).toContain("Barcelona");
    expect(result.text).toContain("Hotel Arts");
  });

  test("shows payment-not-configured instead of a fake URL", () => {
    const result = renderCustomerOrderConfirmationEmail({
      locale: "en",
      action: "CREATE",
      orderId: "order-es-2",
      orderNumber: "2",
      carModel: "Seat Leon",
      rentalStartDate: "2026-09-21T10:00:00.000Z",
      rentalEndDate: "2026-09-24T10:00:00.000Z",
      timeIn: "2026-09-21T10:00:00.000Z",
      timeOut: "2026-09-24T08:00:00.000Z",
      timezone: "Europe/Madrid",
      placeIn: "Madrid",
      placeInDetail: "Calle Mayor 1",
      totalPrice: 100,
      customerName: "Ana",
      paymentLinkStatus: "not_configured",
    });

    expect(result.html).not.toContain("checkout.stripe.com");
    expect(result.html).toContain("payment link is not configured");
    expect(result.text).toContain("Calle Mayor 1");
  });
});
