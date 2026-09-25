import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SuccessMessage from "../SuccessMessage";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe("SuccessMessage numberOfDays", () => {
  test("shows numberOfDays from submitted order in user UI", () => {
    const submittedOrder = {
      carModel: "Toyota Yaris",
      numberOfDays: 6,
      totalPrice: 420,
      timeIn: "2026-05-02T09:00:00.000Z",
      timeOut: "2026-05-08T09:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      <SuccessMessage
        submittedOrder={submittedOrder}
        presetDates={{ startDate: null, endDate: null }}
        onClose={() => {}}
        emailSent={false}
      />
    );

    expect(html).toContain("bookMesssages.bookDays");
    expect(html).toContain(">6<");
  });

  test("marketplace request never shows a pay CTA", () => {
    const html = renderToStaticMarkup(
      <SuccessMessage
        submittedOrder={{
          carModel: "Seat Leon",
          numberOfDays: 3,
          totalPrice: 240,
          timeIn: "2026-09-21T10:00:00.000Z",
          timeOut: "2026-09-24T10:00:00.000Z",
          bookingMode: "MARKETPLACE_REQUEST",
          paymentUrl: "https://checkout.stripe.com/c/pay/cs_test_spain",
          paymentLinkStatus: "ready",
        }}
        presetDates={{ startDate: null, endDate: null }}
        onClose={() => {}}
        emailSent={false}
      />
    );

    expect(html).not.toContain("https://checkout.stripe.com/c/pay/cs_test_spain");
    expect(html).not.toContain("bookMesssages.payPrepayment");
    expect(html).toContain("bookMesssages.bookRequestSent");
    expect(html).toContain("bookMesssages.bookCompanyReview");
  });

  test("shows pay CTA when paymentUrl is present", () => {
    const html = renderToStaticMarkup(
      <SuccessMessage
        submittedOrder={{
          carModel: "Seat Leon",
          numberOfDays: 3,
          totalPrice: 240,
          timeIn: "2026-09-21T10:00:00.000Z",
          timeOut: "2026-09-24T10:00:00.000Z",
          paymentUrl: "https://checkout.stripe.com/c/pay/cs_test_spain",
          paymentLinkStatus: "ready",
        }}
        presetDates={{ startDate: null, endDate: null }}
        onClose={() => {}}
        emailSent={false}
      />
    );

    expect(html).toContain("https://checkout.stripe.com/c/pay/cs_test_spain");
    expect(html).toContain("bookMesssages.payPrepayment");
  });

  test("shows not-configured copy instead of a fake URL", () => {
    const html = renderToStaticMarkup(
      <SuccessMessage
        submittedOrder={{
          carModel: "Seat Leon",
          numberOfDays: 3,
          totalPrice: 240,
          timeIn: "2026-09-21T10:00:00.000Z",
          timeOut: "2026-09-24T10:00:00.000Z",
          paymentLinkStatus: "not_configured",
        }}
        presetDates={{ startDate: null, endDate: null }}
        onClose={() => {}}
        emailSent={false}
      />
    );

    expect(html).not.toContain("checkout.stripe.com");
    expect(html).toContain("bookMesssages.paymentLinkNotConfigured");
  });
});
