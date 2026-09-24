/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import {
  ADMIN_LEGAL_LANGUAGES,
  attentionMessage,
  canonicalPublicPath,
  compactLanguageBadge,
  customerDocumentRows,
  languagePublicationState,
  orderedAdminDocuments,
  partnerDocumentRows,
  summarizeAdminLanguages,
} from "@/domain/legal/legalAdminUi";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("simplified Legal documents admin", () => {
  it("lists exactly six documents in two groups of three", () => {
    expect(customerDocumentRows()).toHaveLength(3);
    expect(partnerDocumentRows()).toHaveLength(3);
    expect(orderedAdminDocuments()).toHaveLength(6);
    expect(customerDocumentRows().map((row) => row.documentType)).toEqual([
      LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
      LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY,
      LEGAL_DOCUMENT_TYPE.COOKIE_POLICY,
    ]);
    expect(partnerDocumentRows().map((row) => row.documentType)).toEqual([
      LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
      LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES,
      LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE,
    ]);
    expect(ADMIN_LEGAL_LANGUAGES).toEqual([
      "en",
      "es",
      "ru",
      "uk",
      "ca",
      "fr",
      "de",
      "pt",
    ]);
  });

  it("canonical public links use language routes", () => {
    expect(canonicalPublicPath(LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS, "en")).toBe(
      "/en/terms"
    );
    expect(canonicalPublicPath(LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY, "es")).toBe(
      "/es/privacy-policy"
    );
    expect(canonicalPublicPath(LEGAL_DOCUMENT_TYPE.COOKIE_POLICY, "ru")).toBe(
      "/ru/cookie-policy"
    );
    expect(canonicalPublicPath(LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT, "fr")).toBe(
      "/fr/partner-agreement"
    );
    expect(
      canonicalPublicPath(LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES, "pt")
    ).toBe("/pt/partner-operating-rules");
    expect(
      canonicalPublicPath(LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE, "uk")
    ).toBe("/uk/data-protection-schedule");
  });

  it("marks unpublished changes vs published vs not published", () => {
    expect(languagePublicationState(null).key).toBe("not_published");
    expect(
      languagePublicationState({
        published: { version: 1, publishedAt: "2026-09-24T10:00:00.000Z" },
      }).label
    ).toMatch(/Published · 24 Sep 2026/);
    expect(
      languagePublicationState({
        published: { version: 1, publishedAt: "2026-09-01" },
        draft: { version: 2 },
        latestStatus: "draft",
        latestVersion: 2,
      }).key
    ).toBe("unpublished_changes");
    expect(compactLanguageBadge(null, "en")).toBe("EN · Draft");
  });

  it("summarises language versions across all admin languages", () => {
    const overview = orderedAdminDocuments().map((row, index) => ({
      documentType: row.documentType,
      languages: {
        en: { published: { version: 1, publishedAt: "2026-09-24" } },
        es:
          index === 0
            ? {}
            : { published: { version: 1, publishedAt: "2026-09-24" } },
      },
    }));
    const summary = summarizeAdminLanguages(overview);
    const total = ADMIN_LEGAL_LANGUAGES.length * orderedAdminDocuments().length;
    expect(summary.total).toBe(total);
    // 6 EN published + 5 ES published; remaining languages unpublished
    expect(summary.published).toBe(11);
    expect(summary.notPublished).toBe(total - 11);
    expect(attentionMessage(summary)).toBe(
      `${total - 11} language versions are not published.`
    );
  });

  it("keeps the main panel focused on save/publish without advanced tooling", () => {
    const panel = read("app/admin/legal/LegalDocumentsPanel.js");
    expect(panel).toContain("Customer documents");
    expect(panel).toContain("Partner documents");
    expect(panel).toContain("Save changes");
    expect(panel).toContain("Changes saved. They are not visible on the website yet.");
    expect(panel).toContain("No unpublished changes.");
    expect(panel).toContain("This will replace the version currently shown on the website.");
    expect(panel).toContain("expanded={expanded}");
    expect(panel).toContain("ADMIN_LANGUAGE_LABELS");
    expect(panel).toContain("variant=\"scrollable\"");
    expect(panel).not.toContain("Translations");
    expect(panel).not.toContain("Advanced");
    expect(panel).not.toContain("Archive");
    expect(panel).not.toContain("Load built-in");
    expect(panel).not.toContain("Publish all");
    expect(panel).not.toContain("LIVE VERSION");
    const hub = read("app/admin/legal/LegalHubSection.js");
    expect(hub).toContain("LegalDocumentsPanel");
    expect(hub).not.toContain("LegalDocumentCards");
    expect(hub).not.toContain("BookingFeeOutcomesTable");
  });

  it("points six public routes at published-only content", () => {
    for (const file of [
      "app/[locale]/terms/page.js",
      "app/[locale]/privacy-policy/page.js",
      "app/[locale]/cookie-policy/page.js",
      "app/[locale]/partner-agreement/page.js",
      "app/[locale]/partner-operating-rules/page.js",
      "app/[locale]/data-protection-schedule/page.js",
    ]) {
      const src = read(file);
      expect(src).toContain("publishedOnly");
      expect(src).toContain("PublicLegalPageLayout");
    }
    const overview = read("app/[locale]/partner-terms/page.js");
    expect(overview).toContain("partner-terms-overview");
    expect(overview).toContain("partner-agreement");
    expect(overview).not.toContain("publishedOnly");
    expect(read("app/[locale]/privacy/page.js")).toContain("/privacy-policy");
    expect(read("app/[locale]/cookies/page.js")).toContain("/cookie-policy");
  });

  it("keeps partner package snapshots with language", () => {
    const src = read("domain/legal/companyLegalPage.js");
    expect(src).toContain("language: doc.language");
    expect(src).toContain("checksum: doc.checksum");
    expect(src).toContain("version: doc.version");
    expect(src).toContain("MASTER_AGREEMENT_PACKAGE");
  });
});
