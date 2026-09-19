/**
 * @jest-environment node
 */

import {
  getVoucherMarketLocales,
  resolveVoucherLocaleForMarket,
  voucherFieldLabel,
  voucherUiText,
} from "@/domain/vouchers/transferVoucher";

describe("transfer voucher market locales", () => {
  it("uses Español + English for Spain", () => {
    const market = getVoucherMarketLocales("ES");
    expect(market.locales).toEqual(["es", "en"]);
    expect(market.tabLabels.es).toBe("Español");
    expect(market.primary).toBe("es");
  });

  it("uses Ελληνικά + English for Greece / default", () => {
    expect(getVoucherMarketLocales("GR").locales).toEqual(["el", "en"]);
    expect(getVoucherMarketLocales("").locales).toEqual(["el", "en"]);
  });

  it("maps site language into the market pair", () => {
    expect(resolveVoucherLocaleForMarket("el", "ES")).toBe("es");
    expect(resolveVoucherLocaleForMarket("es", "ES")).toBe("es");
    expect(resolveVoucherLocaleForMarket("en", "ES")).toBe("en");
    expect(resolveVoucherLocaleForMarket("es", "GR")).toBe("en");
    expect(resolveVoucherLocaleForMarket("el", "GR")).toBe("el");
  });

  it("returns Spanish voucher labels", () => {
    expect(voucherFieldLabel("title", "es")).toBe("Vale de traslado");
    expect(voucherUiText("reset", "es")).toBe("Restablecer");
  });
});
