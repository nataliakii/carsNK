/**
 * @jest-environment node
 */

import {
  formatVoucherLabel,
  getVoucherMarketLocales,
  resolveVoucherLocaleForMarket,
  resolveVoucherMarketCountry,
  voucherEmailPlainMessage,
  voucherFieldLabel,
  voucherUiText,
} from "@/domain/vouchers/transferVoucher";

describe("transfer voucher market locales", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_COUNTRY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = originalSite || "GR";
  });

  it("uses Español + English for Spain", () => {
    const market = getVoucherMarketLocales("ES");
    expect(market.locales).toEqual(["es", "en"]);
    expect(market.tabLabels.es).toBe("Español");
    expect(market.primary).toBe("es");
  });

  it("uses Ελληνικά + English for Greece / default", () => {
    expect(getVoucherMarketLocales("GR").locales).toEqual(["el", "en"]);
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    expect(getVoucherMarketLocales("").locales).toEqual(["el", "en"]);
  });

  it("falls back to the Spain site when company country is missing", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    expect(resolveVoucherMarketCountry("")).toBe("ES");
    expect(getVoucherMarketLocales("").locales).toEqual(["es", "en"]);
    expect(resolveVoucherLocaleForMarket("el", "")).toBe("es");
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

  it("pairs bilingual labels with Spanish on ES, Greek on GR", () => {
    expect(
      formatVoucherLabel("title", { locale: "en", bilingual: true, country: "ES" })
        .secondary
    ).toBe("Vale de traslado");
    expect(
      formatVoucherLabel("title", { locale: "en", bilingual: true, country: "GR" })
        .secondary
    ).toBe("Κουπόνι μεταφοράς");
  });

  it("uses Spanish+English email intro on ES and Greek+English on GR", () => {
    expect(voucherEmailPlainMessage("ES")).toContain("Vale de traslado");
    expect(voucherEmailPlainMessage("ES")).not.toContain("Κουπόνι");
    expect(voucherEmailPlainMessage("GR")).toContain("Κουπόνι μεταφοράς");
  });
});
