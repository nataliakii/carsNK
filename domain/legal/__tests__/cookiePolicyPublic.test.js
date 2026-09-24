/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

import {
  collectRequiredPublishTargets,
  platformDocumentsNeedPublish,
  platformDocumentDisplayName,
  REQUIRED_PLATFORM_PUBLISH_LANGUAGES,
} from "@/domain/legal/platformPublish";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import { PLATFORM_DOCUMENT_CATALOG } from "@/domain/legal/platformCatalog";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function draftOverview(overrides = {}) {
  return PLATFORM_DOCUMENT_CATALOG.map((doc) => {
    const override = overrides[doc.documentType] || {};
    return {
      documentType: doc.documentType,
      languages: {
        en: override.en || {
          latestVersion: 1,
          latestStatus: "draft",
          published: null,
        },
        es: override.es || {
          latestVersion: 1,
          latestStatus: "draft",
          published: null,
        },
        ru: { latestVersion: null, latestStatus: "missing", published: null },
        uk: { latestVersion: null, latestStatus: "missing", published: null },
      },
    };
  });
}

describe("Cookie Policy public publishing workflow", () => {
  it("includes Cookie Policy among the six platform documents", () => {
    expect(PLATFORM_DOCUMENT_CATALOG).toHaveLength(6);
    expect(
      PLATFORM_DOCUMENT_CATALOG.some(
        (row) => row.documentType === LEGAL_DOCUMENT_TYPE.COOKIE_POLICY
      )
    ).toBe(true);
    expect(platformDocumentDisplayName(LEGAL_DOCUMENT_TYPE.COOKIE_POLICY)).toBe(
      "Cookie Policy"
    );
    expect(REQUIRED_PLATFORM_PUBLISH_LANGUAGES).toEqual(["en", "es"]);
  });

  it("publish-all targets include Cookie Policy EN and ES drafts", () => {
    const targets = collectRequiredPublishTargets(draftOverview());
    const cookie = targets.filter(
      (row) => row.documentType === LEGAL_DOCUMENT_TYPE.COOKIE_POLICY
    );
    expect(cookie).toEqual([
      { documentType: "cookie-policy", language: "en", version: 1 },
      { documentType: "cookie-policy", language: "es", version: 1 },
    ]);
    expect(platformDocumentsNeedPublish(draftOverview())).toBe(true);
  });

  it("skips already published Cookie Policy languages", () => {
    const overview = draftOverview({
      [LEGAL_DOCUMENT_TYPE.COOKIE_POLICY]: {
        en: {
          latestVersion: 1,
          latestStatus: "published",
          published: { version: 1 },
        },
        es: {
          latestVersion: 1,
          latestStatus: "draft",
          published: null,
        },
      },
    });
    const cookie = collectRequiredPublishTargets(overview).filter(
      (row) => row.documentType === LEGAL_DOCUMENT_TYPE.COOKIE_POLICY
    );
    expect(cookie).toEqual([
      { documentType: "cookie-policy", language: "es", version: 1 },
    ]);
  });

  it("renders the Cookie Policy page from published Rovaro documents only", () => {
    const page = read("app/[locale]/cookie-policy/page.js");
    expect(page).toContain("PublicLegalPageLayout");
    expect(page).toContain("RovaroLegalDocument");
    expect(page).toContain("LEGAL_DOCUMENT_TYPE.COOKIE_POLICY");
    expect(page).toContain("publishedOnly");
    expect(page).not.toContain("LegalPageContent");
    expect(page).not.toContain("getLegalDoc");
  });

  it("aliases /cookies to /cookie-policy without auth", () => {
    const alias = read("app/[locale]/cookies/page.js");
    expect(alias).toContain("permanentRedirect");
    expect(alias).toContain("/cookie-policy");
    expect(alias).not.toContain("getServerSession");
    expect(alias).not.toContain("requireAuth");

    const page = read("app/[locale]/cookie-policy/page.js");
    expect(page).not.toContain("getServerSession");
    expect(page).not.toContain("requireAuth");
    expect(page).not.toContain("requirePlatformAdmin");
  });

  it("shows a preparing fallback and Retry on unexpected failure", () => {
    const component = read("app/(legal)/_components/RovaroLegalDocument.js");
    expect(component).toContain("is being prepared.");
    expect(component).toContain("Rovaro Customer Booking Terms are being prepared.");
    expect(component).toContain("publishedOnly");
    expect(component).toContain("getPublishedDocument");
    expect(component).toContain("LegalDocumentRetry");
    expect(component).toContain('console.error');
    expect(component).not.toContain("Failed to fetch");

    const retry = read("app/(legal)/_components/LegalDocumentRetry.js");
    expect(retry).toContain("Retry");
    expect(retry).toContain("We could not load this page right now");
    expect(retry).not.toContain("Failed to fetch");
  });

  it("keeps language publish controls inside Advanced only", () => {
    const hub = read("app/admin/legal/LegalHubSection.js");
    expect(hub).toContain('action: "publishAll"');
    expect(hub).toContain("Publish all required documents");
    expect(hub).toContain("Advanced");
    expect(hub).toContain("Accordion");
    expect(hub).toContain("platformDocumentsNeedPublish");
    // Card-level Publish update is allowed; Advanced keeps per-language Publish EN/ES.
    expect(hub).toContain("onPublish");
    expect(hub.slice(hub.indexOf("<Accordion"))).toContain(
      't("admin.legalHub.publishLang"'
    );
  });

  it("public legal API serves published Cookie Policy without a session", () => {
    const route = read("app/api/public/legal/[docType]/route.js");
    expect(route).toContain("getPublishedDocument");
    expect(route).toContain("NOT_PUBLISHED");
    expect(route).toContain("No authentication is required");
    expect(route).not.toContain("requireSuperAdmin");
    expect(route).not.toContain("requirePlatformAdmin");
    expect(route).not.toContain("getServerSession");
    expect(route).not.toContain("resolveDocumentForDisplay");
  });
});
