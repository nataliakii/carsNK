/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

import {
  CUSTOMER_TERMS_SEGMENT,
  LEGACY_CUSTOMER_TERMS_SEGMENTS,
  canonicalTermsPath,
  isLegacyCustomerTermsPath,
} from "@/domain/legal/customerTermsRoute";
import { PLATFORM_DOCUMENT_CATALOG } from "@/domain/legal/platformCatalog";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("canonical customer Terms route", () => {
  it("builds one locale-aware path and preserves query parameters", () => {
    expect(CUSTOMER_TERMS_SEGMENT).toBe("/terms");
    expect(canonicalTermsPath("es")).toBe("/es/terms");
    expect(canonicalTermsPath("en", { utm_source: "email", ref: "a b" })).toBe(
      "/en/terms?utm_source=email&ref=a+b"
    );
    expect(canonicalTermsPath("en", new URLSearchParams({ lang: "ru" }))).toBe(
      "/en/terms?lang=ru"
    );
    expect(canonicalTermsPath("en", {})).toBe("/en/terms");
  });

  it("treats the old customer routes as legacy aliases", () => {
    expect(LEGACY_CUSTOMER_TERMS_SEGMENTS).toEqual(["/rental-terms", "/booking-terms"]);
    expect(isLegacyCustomerTermsPath("/rental-terms")).toBe(true);
    expect(isLegacyCustomerTermsPath("/booking-terms")).toBe(true);
    expect(isLegacyCustomerTermsPath("/terms")).toBe(false);
    // Supplier agreement routes are untouched.
    expect(isLegacyCustomerTermsPath("/partner-terms")).toBe(false);
    expect(isLegacyCustomerTermsPath("/data-protection-schedule")).toBe(false);
  });

  it("renders the customer terms in exactly one page", () => {
    const canonical = read("app/[locale]/terms/page.js");
    expect(canonical).toContain("PublicLegalPageLayout");
    expect(canonical).toContain("RovaroLegalDocument");
    expect(canonical).toContain("BookingFeeOutcomesTable");
    expect(canonical).toContain("/${normalized}/terms");
    // Fee table is a child of RovaroLegalDocument so unpublished hides it.
    expect(canonical).toMatch(
      /RovaroLegalDocument[\s\S]*BookingFeeOutcomesTable[\s\S]*<\/RovaroLegalDocument>/
    );

    for (const alias of ["app/[locale]/booking-terms/page.js", "app/[locale]/rental-terms/page.js"]) {
      const src = read(alias);
      expect(src).toContain("permanentRedirect");
      expect(src).toContain("canonicalTermsPath");
      expect(src).not.toContain("RovaroLegalDocument");
      expect(src).not.toContain("RentalTermsContent");
    }
  });

  it("points customer-facing links at the canonical route", () => {
    const navbar = read("app/components/Navbar.js");
    const footer = read("app/components/Footer.js");
    expect(navbar).toContain("CUSTOMER_TERMS_SEGMENT");
    expect(navbar).not.toContain('localeLink("/rental-terms")');
    expect(footer).toContain("CUSTOMER_TERMS_SEGMENT");
    expect(footer).not.toContain('localeLink("/booking-terms")');

    const catalog = PLATFORM_DOCUMENT_CATALOG.find(
      (row) => row.documentType === LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS
    );
    expect(catalog.publicPath).toBe(CUSTOMER_TERMS_SEGMENT);
  });

  it("redirects legacy paths in middleware instead of rendering them", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toContain("isLegacyCustomerTermsPath");
    expect(middleware).toContain("CUSTOMER_TERMS_SEGMENT");
    expect(middleware).not.toContain('getStaticPagePath(locale, "rental-terms")');
    expect(middleware).toContain("withSearchParams");
  });

  it("preserves query params on the bare /rental-terms redirect page", () => {
    const bare = read("app/(legal)/rental-terms/page.js");
    expect(bare).toContain("searchParams");
    expect(bare).toContain("canonicalTermsPath");
  });
});
