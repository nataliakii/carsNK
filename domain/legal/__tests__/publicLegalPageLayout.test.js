/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

import {
  PUBLIC_LEGAL_MAIN_CONTAINER,
  PUBLIC_LEGAL_STATUS_PREPARING,
  PUBLIC_LEGAL_STATUS_ERROR,
} from "@/domain/legal/publicLegalPageLayout";
import { platformDocumentDisplayName } from "@/domain/legal/platformPublish";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const CUSTOMER_PAGES = [
  "app/[locale]/terms/page.js",
  "app/[locale]/privacy-policy/page.js",
  "app/[locale]/cookie-policy/page.js",
];

describe("public legal page layout", () => {
  it("defines one MainContainer matching the public site edges", () => {
    expect(PUBLIC_LEGAL_MAIN_CONTAINER.width).toBe("100%");
    expect(PUBLIC_LEGAL_MAIN_CONTAINER.maxWidth).toBe(1400);
    expect(PUBLIC_LEGAL_MAIN_CONTAINER.marginInline).toBe("auto");
    expect(PUBLIC_LEGAL_MAIN_CONTAINER.paddingInline).toEqual({
      xs: 2,
      sm: 3,
      md: 4,
    });
    expect(PUBLIC_LEGAL_STATUS_PREPARING.backgroundColor).toBe("#fff3e0");
    expect(PUBLIC_LEGAL_STATUS_ERROR.backgroundColor).toBe("#ffebee");
  });

  it("Terms, Privacy, and Cookies share PublicLegalPageLayout", () => {
    for (const file of CUSTOMER_PAGES) {
      const src = read(file);
      expect(src).toContain("PublicLegalPageLayout");
      expect(src).toContain("RovaroLegalDocument");
      expect(src).toContain("publishedOnly");
      expect(src).not.toContain("<Feed");
    }

    const layout = read("app/(legal)/_components/PublicLegalPageLayout.js");
    expect(layout).toContain("PUBLIC_LEGAL_MAIN_CONTAINER");
    expect(layout).toContain("data-testid=\"public-legal-main\"");
    expect(layout).toContain("Feed");
  });

  it("keeps all public legal content inside MainContainer (no nested 820px / 100vw)", () => {
    const doc = read("app/(legal)/_components/RovaroLegalDocument.js");
    expect(doc).not.toContain("maxWidth: 820");
    expect(doc).not.toContain("maxWidth: 800");
    expect(doc).toContain("PUBLIC_LEGAL_STATUS_PREPARING");
    expect(doc).toContain("public-legal-unpublished");
    expect(doc).toContain("public-legal-published");

    const retry = read("app/(legal)/_components/LegalDocumentRetry.js");
    expect(retry).not.toContain("maxWidth: 820");
    expect(retry).toContain("PUBLIC_LEGAL_STATUS_ERROR");

    const table = read("app/components/Legal/BookingFeeOutcomesTable.js");
    expect(table).not.toMatch(/width:\s*["']100vw["']/);
    expect(table).not.toMatch(/100vw\s*[,}]/);
    expect(table).not.toContain("marginLeft: -");
    expect(table).not.toContain("ml: -");
    expect(table).toContain("width: \"100%\"");
    expect(table).toContain("maxWidth: \"100%\"");
    expect(table).toContain("overflowX");
  });

  it("gates BookingFeeOutcomesTable behind successful published Customer Booking Terms", () => {
    const terms = read("app/[locale]/terms/page.js");
    expect(terms).toContain("BookingFeeOutcomesTable");
    expect(terms).toMatch(
      /RovaroLegalDocument[\s\S]*BookingFeeOutcomesTable[\s\S]*<\/RovaroLegalDocument>/
    );

    const doc = read("app/(legal)/_components/RovaroLegalDocument.js");
    expect(doc).toContain("{children}");
    expect(doc).toContain("return <PreparingMessage documentType={documentType} />");
    expect(doc).toContain("return <LegalDocumentRetry />");
    // Unpublished / error paths return before the published fragment that renders children.
    const publishedReturn = doc.slice(doc.indexOf("<article data-testid=\"public-legal-published\">"));
    expect(publishedReturn).toContain("{children}");
    const preparingBlock = doc.slice(
      doc.indexOf("function PreparingMessage"),
      doc.indexOf("function DocumentHeader")
    );
    expect(preparingBlock).not.toContain("children");
  });

  it("unpublished Customer Booking Terms shows preparing copy only", () => {
    expect(
      platformDocumentDisplayName(LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS)
    ).toBe("Rovaro Customer Booking Terms");

    const doc = read("app/(legal)/_components/RovaroLegalDocument.js");
    expect(doc).toContain("Rovaro Customer Booking Terms are being prepared.");
    expect(doc).toContain("is being prepared.");
    expect(doc).toContain("publishedOnly");
    expect(doc).toContain("getPublishedDocument");
    // Draft label must not appear on publishedOnly success path source values.
    expect(doc).toContain('source: published ? "published" : "none"');
  });

  it("does not expose draft resolution on public customer pages", () => {
    for (const file of CUSTOMER_PAGES) {
      const src = read(file);
      expect(src).toContain("publishedOnly");
      expect(src).not.toContain("resolveDocumentForDisplay");
    }
  });

  it("table scrolls internally on narrow viewports without page overflow helpers", () => {
    const table = read("app/components/Legal/BookingFeeOutcomesTable.js");
    expect(table).toContain("overflowX: needsHorizontalScroll ? \"auto\"");
    expect(table).toContain("WebkitOverflowScrolling: \"touch\"");
    expect(table).toContain("minWidth: COL_MIN_WIDTH");
    expect(table).toContain("scope=\"col\"");
    expect(table).toContain("aria-label={table.title}");
  });
});
