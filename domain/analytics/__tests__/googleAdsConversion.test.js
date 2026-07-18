/**
 * @jest-environment jsdom
 */
import {
  reportGoogleAdsConversion,
  reportGoogleAdsPurchaseFromOrder,
  GOOGLE_ADS_PURCHASE_SEND_TO,
} from "../googleAdsConversion.js";

describe("reportGoogleAdsConversion", () => {
  beforeEach(() => {
    delete window.gtag;
    delete window.gtag_report_conversion;
  });

  it("calls gtag with send_to and value when gtag exists", () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    reportGoogleAdsConversion({
      value: 42.5,
      transactionId: "ORD-1",
    });
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "conversion",
      expect.objectContaining({
        send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
        value: 42.5,
        currency: "EUR",
        transaction_id: "ORD-1",
      })
    );
  });

  it("does not throw when gtag is missing", () => {
    expect(() =>
      reportGoogleAdsConversion({ value: 1, transactionId: "" })
    ).not.toThrow();
  });

  it("maps order to value and transaction id", () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    reportGoogleAdsPurchaseFromOrder({
      totalPrice: 199,
      orderNumber: "20260324120000",
    });
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "conversion",
      expect.objectContaining({
        value: 199,
        transaction_id: "20260324120000",
      })
    );
  });

  it("sends new_customer only when explicitly known", () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    reportGoogleAdsPurchaseFromOrder(
      { totalPrice: 10, orderNumber: "ORD-2" },
      { newCustomer: true }
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "conversion",
      expect.objectContaining({
        new_customer: true,
      })
    );
  });
});
