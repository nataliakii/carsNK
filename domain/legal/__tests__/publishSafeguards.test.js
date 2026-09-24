/**
 * @jest-environment node
 */

import {
  assertNotTestContentInProduction,
  detectTestLegalContent,
  TEST_CONTENT_PRODUCTION_MESSAGE,
  isProductionLegalRuntime,
} from "@/domain/legal/testContentGuard";
import {
  assertTestDatabaseIsolation,
  assertBrowserQaPublishAllowed,
  isClearlyTestDatabase,
  looksLikeProductionDatabase,
} from "@/domain/legal/environmentDbGuard";
import { getSeedDocuments } from "@/domain/legal/documentRegistry";
import fs from "fs";
import path from "path";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("legal publish safeguards", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects QA/test markers and testOnly fixtures", () => {
    expect(
      detectTestLegalContent({
        content: { title: "QA", sections: [{ id: "1", body: "draft save test" }] },
      }).isTest
    ).toBe(true);
    expect(
      detectTestLegalContent({
        testOnly: true,
        content: { title: "Rovaro Booking Terms", sections: [] },
      }).isTest
    ).toBe(true);
    expect(
      detectTestLegalContent({
        content: {
          title: "Rovaro Booking Terms",
          sections: [{ id: "1", heading: "Who we are", body: "Real terms." }],
        },
      }).isTest
    ).toBe(false);
  });

  it("blocks test content in production with the required message", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NODE_ENV = "production";
    const blocked = assertNotTestContentInProduction({
      content: { title: "QA", sections: [{ id: "1", body: "draft save test" }] },
      testOnly: false,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toBe(TEST_CONTENT_PRODUCTION_MESSAGE);

    const testOnlyBlocked = assertNotTestContentInProduction({
      testOnly: true,
      content: { title: "Anything", sections: [] },
    });
    expect(testOnlyBlocked.ok).toBe(false);
  });

  it("allows non-test content in production", () => {
    process.env.VERCEL_ENV = "production";
    const ok = assertNotTestContentInProduction({
      content: {
        title: "Rovaro Booking Terms",
        sections: [{ id: "1", body: "Customer booking terms body." }],
      },
    });
    expect(ok.ok).toBe(true);
  });

  it("fail-closes when NODE_ENV=test without a clearly identified test DB", () => {
    process.env.NODE_ENV = "test";
    delete process.env.JEST_WORKER_ID;
    process.env.JEST_WORKER_ID = "1";
    expect(() =>
      assertTestDatabaseIsolation({
        uri: "mongodb+srv://user:pass@cluster0.gn8sza1.mongodb.net/",
        dbName: "Car",
      })
    ).toThrow(/clearly identify a test DB|production/i);

    expect(
      assertTestDatabaseIsolation({
        uri: "mongodb://127.0.0.1:27017/nk_cars_test",
        dbName: "nk_cars_test",
      }).ok
    ).toBe(true);
  });

  it("never treats production Car DB as a test database", () => {
    expect(isClearlyTestDatabase("mongodb+srv://x@cluster0.gn8sza1.mongodb.net/", "Car")).toBe(
      false
    );
    expect(looksLikeProductionDatabase("mongodb+srv://x@cluster0.gn8sza1.mongodb.net/", "Car")).toBe(
      true
    );
  });

  it("blocks browser QA publish against production hosts", () => {
    expect(() =>
      assertBrowserQaPublishAllowed({ siteUrl: "https://rovaro.es", allowPublish: false })
    ).toThrow(/stop before real publication/i);
  });

  it("seed fixtures across six docs/locales are not QA content", () => {
    const seeds = getSeedDocuments();
    expect(seeds.length).toBeGreaterThanOrEqual(10);
    for (const doc of seeds) {
      expect(detectTestLegalContent(doc).isTest).toBe(false);
      expect(doc.testOnly).toBeFalsy();
    }
    const types = new Set(seeds.map((d) => d.documentType));
    expect(types.has("customer-booking-terms")).toBe(true);
    expect(types.has("privacy-policy")).toBe(true);
    expect(types.has("cookie-policy")).toBe(true);
  });

  it("publish pipeline archives previous, sets current pointer, and verifies checksum", () => {
    const service = read("domain/legal/documentService.js");
    expect(service).toContain("LegalDocumentCurrent");
    expect(service).toContain("upsertCurrentPointer");
    expect(service).toContain("publish_verify_failed");
    expect(service).toContain("expectedChecksum");
    expect(service).toContain("assertNotTestContentInProduction");
    expect(service).toContain("restorePreviousPublishedVersion");
    expect(service).toContain("resolveCurrentPublishedRow");
  });

  it("public resolution uses current pointer before newest published", () => {
    const service = read("domain/legal/documentService.js");
    expect(service).toContain("resolveCurrentPublishedRow");
    expect(service.indexOf("LegalDocumentCurrent")).toBeLessThan(
      service.indexOf("export async function getPublishedDocument")
    );
  });

  it("admin UI requires PUBLISH confirm and shows live test banner + restore", () => {
    const dialog = read("app/admin/legal/LegalPublishConfirmDialog.js");
    expect(dialog).toContain("Type PUBLISH to confirm");
    expect(dialog).toContain("legal-publish-content-preview");

    const banner = read("app/admin/legal/LiveTestContentBanner.js");
    expect(banner).toContain("Invalid test content is currently live.");
    expect(banner).toContain("Restore previous version");
    expect(banner).toContain("View live");

    const hub = read("app/admin/legal/LegalHubSection.js");
    expect(hub).toContain("LegalPublishConfirmDialog");
    expect(hub).toContain("LiveTestContentBanner");
    expect(hub).toContain('publishConfirm: "PUBLISH"');
    expect(hub).toContain("restorePrevious");

    const workspace = read("app/admin/legal/LegalDocumentWorkspace.js");
    expect(workspace).toContain("LegalPublishConfirmDialog");
    expect(workspace).toContain('publishConfirm: "PUBLISH"');
    expect(workspace).toContain("View live page");
  });

  it("API rejects production publish without typed PUBLISH and blocks test content", () => {
    const api = read("app/api/admin/legal/documents/route.js");
    expect(api).toContain("publish_confirm_required");
    expect(api).toContain("TEST_CONTENT_PRODUCTION_MESSAGE");
    expect(api).toContain("restorePrevious");
    expect(api).toContain("qa_publish_blocked");
    expect(api).toContain("listLiveTestContentDocuments");
  });

  it("database connect asserts test DB isolation", () => {
    const db = read("lib/database.js");
    expect(db).toContain("assertTestDatabaseIsolation");
  });

  it("import preview path does not auto-publish", () => {
    const workspace = read("app/admin/legal/LegalDocumentWorkspace.js");
    expect(workspace).toContain("Import preview — not saved yet");
    expect(workspace).toContain("Nothing is public until you publish");
    expect(workspace).not.toContain("forceNewVersion: true");
  });

  it("exposes isProductionLegalRuntime helper", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    expect(isProductionLegalRuntime()).toBe(true);
    process.env.VERCEL_ENV = "preview";
    expect(isProductionLegalRuntime()).toBe(false);
    process.env.VERCEL_ENV = prev;
  });
});
