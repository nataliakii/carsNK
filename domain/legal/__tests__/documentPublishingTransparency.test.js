/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

import {
  livePathForDocument,
  nextImportDraftVersion,
  splitLiveAndDraft,
} from "@/domain/legal/documentCardStatus";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import { importLegalFile } from "@/domain/legal/documentImport";
import { getSeedDocument, getSeedDocuments } from "@/domain/legal/documentRegistry";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("legal document publishing transparency", () => {
  it("keeps live and unpublished draft visually separate in the view model", () => {
    const split = splitLiveAndDraft({
      published: {
        version: 1,
        publishedAt: "2026-01-01",
        publishedByEmail: "admin@rovaro.autos",
      },
      latestVersion: 2,
      latestStatus: "draft",
      draft: {
        version: 2,
        sourceFilename: "terms-v2.md",
        updatedAt: "2026-02-01",
        savedByEmail: "editor@rovaro.autos",
      },
    });
    expect(split.live).toEqual({
      version: 1,
      status: "Published",
      publishedAt: "2026-01-01",
      publishedBy: "admin@rovaro.autos",
    });
    expect(split.draft).toEqual({
      version: 2,
      status: "Draft",
      sourceFilename: "terms-v2.md",
      savedAt: "2026-02-01",
      savedBy: "editor@rovaro.autos",
    });
    expect(nextImportDraftVersion({
      published: { version: 1 },
      latestVersion: 1,
      latestStatus: "published",
    })).toBe(2);
  });

  it("maps View live page aliases for customer documents", () => {
    expect(livePathForDocument(LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS)).toBe(
      "/terms"
    );
    expect(livePathForDocument(LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY)).toBe(
      "/privacy"
    );
    expect(livePathForDocument(LEGAL_DOCUMENT_TYPE.COOKIE_POLICY)).toBe(
      "/cookies"
    );
  });

  it("import preview never publishes", () => {
    const result = importLegalFile({
      filename: "policy.md",
      bytes: Buffer.from("# Title\n\nBody text for preview only."),
    });
    expect(result.ok).toBe(true);
    expect(result.published).toBe(false);

    const workspace = read("app/admin/legal/LegalDocumentWorkspace.js");
    expect(workspace).toContain("Import preview — not saved yet");
    expect(workspace).toContain("Save as draft");
    expect(workspace).toContain("Draft v${version} saved");
    expect(workspace).toContain("Publish update");
    expect(workspace).toContain("View live page");
    expect(workspace).not.toContain("forceNewVersion: true");
  });

  it("document cards expose LIVE VERSION and UNPUBLISHED CHANGES with audit fields", () => {
    const cards = read("app/admin/legal/LegalDocumentCards.js");
    expect(cards).toContain("LIVE VERSION");
    expect(cards).toContain("UNPUBLISHED CHANGES");
    expect(cards).toContain("View live page");
    expect(cards).toContain("Publish update");
    expect(cards).toContain("Delete draft");
    expect(cards).toContain("Source file:");
    expect(cards).toContain("Published by:");
    expect(cards).toContain("Saved by:");
  });

  it("public customer and partner pages fetch published content only", () => {
    for (const file of [
      "app/[locale]/terms/page.js",
      "app/[locale]/privacy-policy/page.js",
      "app/[locale]/cookie-policy/page.js",
      "app/[locale]/partner-terms/page.js",
      "app/[locale]/partner-operating-rules/page.js",
      "app/[locale]/data-protection-schedule/page.js",
    ]) {
      const src = read(file);
      expect(src).toContain("publishedOnly");
      expect(src).toContain("PublicLegalPageLayout");
    }
    const api = read("app/api/public/legal/[docType]/route.js");
    expect(api).toContain("getPublishedDocument");
    expect(api).not.toContain("resolveDocumentForDisplay");
  });

  it("removes legal-review disclaimer from every built-in seed document", () => {
    const seeds = getSeedDocuments();
    expect(seeds.length).toBeGreaterThan(0);
    for (const doc of seeds) {
      for (const section of doc.content?.sections || []) {
        expect(String(section.heading || "")).not.toMatch(/legal review/i);
        expect(String(section.heading || "")).not.toMatch(/revisión legal/i);
        expect(String(section.heading || "")).not.toMatch(/revisión jurídica/i);
        expect(String(section.body || "")).not.toMatch(
          /requires professional legal review/i
        );
        expect(String(section.body || "")).not.toMatch(
          /not be relied upon as final/i
        );
      }
    }
    expect(
      getSeedDocument("cookie-policy", "en").content.sections.some((s) =>
        /Legal review/i.test(s.heading)
      )
    ).toBe(false);
  });

  it("saveDocumentDraft never overwrites a published row", () => {
    const src = read("domain/legal/documentService.js");
    expect(src).toContain("Never edit a published (or archived) row in place");
    expect(src).toContain("sourceFilename");
    expect(src).toContain("savedByEmail");
  });
});
