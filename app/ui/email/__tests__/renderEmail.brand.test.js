/**
 * @jest-environment node
 */

const DISCLAIMER =
  "This email does not guarantee that the vehicle is available on these dates at the stated price. Our manager will send you the official confirmation after contacting you and rechecking availability.";

const payload = {
  locale: "en",
  action: "CREATE",
  bookingMode: "MARKETPLACE_REQUEST",
  orderId: "order-brand",
  orderNumber: "20260925134903",
  carModel: "Seat Leon",
  regNumber: "1234ABC",
  rentalStartDate: "2026-09-21T10:00:00.000Z",
  rentalEndDate: "2026-09-24T10:00:00.000Z",
  timeIn: "2026-09-21T10:00:00.000Z",
  timeOut: "2026-09-24T08:00:00.000Z",
  timezone: "Europe/Madrid",
  placeIn: "Barcelona",
  placeOut: "Barcelona",
  numberOfDays: 3,
  ChildSeats: 0,
  insurance: "CDW",
  totalPrice: 240,
  customerName: "Natalia Kirieieva",
};

function renderReservation(country, siteUrl) {
  process.env.NEXT_PUBLIC_SITE_COUNTRY = country;
  process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  let renderCustomerOrderConfirmationEmail;
  let renderRovaroBrandedEmail;
  jest.isolateModules(() => {
    ({ renderCustomerOrderConfirmationEmail } = require("@/app/ui/email/renderEmail"));
    ({ renderRovaroBrandedEmail } = require("@/app/ui/email/templates/rovaroBrandedEmail"));
  });
  return {
    reservation: renderCustomerOrderConfirmationEmail(payload),
    branded: renderRovaroBrandedEmail({
      title: "A replacement car is available",
      introHtml: "<p>Nothing changes until you accept.</p>",
      rows: [["Order", "20260925134903"]],
      cta: { href: "https://rovaro.autos/booking/alternative/1", label: "View offer" },
    }),
  };
}

describe("Rovaro email brand", () => {
  test("reservation email uses the site wordmark and magenta/black, and keeps the disclaimer", () => {
    const { reservation, branded } = renderReservation(
      "ES",
      "https://rovaro.autos"
    );
    const html = reservation.html;

    expect(reservation.title).toBe("Thank you for your reservation – rovaro");
    expect(html).toContain("Natalia Kirieieva");
    expect(html).toContain("#20260925134903");
    expect(html).toContain("Seat Leon");
    expect(html).toContain(DISCLAIMER);
    expect(html).toContain("https://rovaro.autos/brand/rovaro/wordmark-compact.png");
    expect(html).toContain("background-color:#0A0A0A");
    expect(html).toContain("#E9004F");
    expect(html).toContain("border-left:4px solid #E9004F");
    expect(html).not.toContain("#008989");
    expect(html).not.toContain("#FFF8E7");
    expect(html).not.toContain("#D4A017");
    expect(html).not.toContain("Confirmed by Rovaro");

    expect(branded).toContain("https://rovaro.autos/brand/rovaro/wordmark-compact.png");
    expect(branded).toContain("background-color:#0A0A0A");
    expect(branded).toContain("#E9004F");
    expect(branded).toContain("View offer");
    expect(branded).toContain("20260925134903");
    expect(branded).not.toContain("#008989");
  });

  test("Greece emails follow CarsNK navy/cyan instead of the old teal bar", () => {
    const { reservation } = renderReservation("GR", "https://carsnk.gr");
    const html = reservation.html;
    expect(html).toContain("background-color:#0B1F3A");
    expect(html).toContain("#00C8D4");
    expect(html).toContain("/brand/carsnk/wordmark-on-dark.png");
    expect(html).not.toContain("#008989");
    expect(html).not.toContain("#E9004F");
    expect(html).toContain(DISCLAIMER);
  });
});
