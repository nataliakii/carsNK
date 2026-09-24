import {
  formatLegalLanguageStatus,
  LEGAL_LANGUAGE_LABELS,
} from "../languageStatus";
import { importLegalFile } from "../documentImport";
import fs from "fs";
import path from "path";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("legal language status labels", () => {
  it("shows published and newer draft together", () => {
    expect(
      formatLegalLanguageStatus(
        {
          published: { version: 1 },
          latestVersion: 2,
          latestStatus: "draft",
        },
        "en"
      )
    ).toBe("EN — Published v1 · Draft v2 ready for review");
  });

  it("uses full language names when nothing is loaded", () => {
    expect(formatLegalLanguageStatus({}, "ru")).toBe("Russian — Not started");
    expect(formatLegalLanguageStatus(null, "uk")).toBe("Ukrainian — Not started");
    expect(LEGAL_LANGUAGE_LABELS.es).toBe("Spanish");
  });
});

describe("legal document import UI contract", () => {
  it("exposes the import panel and draft-only save actions", () => {
    const src = read("app/admin/legal/LegalDocumentWorkspace.js");
    expect(src).toContain("Import panel");
    expect(src).toContain("Uploading…");
    expect(src).toContain("Reading document…");
    expect(src).toContain("Import preview — not saved yet");
    expect(src).toContain("Save as draft");
    expect(src).toContain("Edit before saving");
    expect(src).toContain("Cancel import");
    expect(src).toContain("Publish update");
    expect(src).toContain("Try again");
    expect(src).toContain("Save as draft");
    // Publish is only available after an explicit Save as draft.
    expect(src).toContain("publishSavedDraft");
    expect(src).toContain('action: "publish"');
    expect(src).toContain('action: "importSave"');
    expect(src).toContain('action: "importPreview"');
  });

  it("parses txt into a preview that is not published", () => {
    const result = importLegalFile({
      filename: "sample.txt",
      bytes: Buffer.from("Heading\n\nBody paragraph for import QA."),
    });
    expect(result.ok).toBe(true);
    expect(result.published).toBe(false);
    expect(result.filename).toBe("sample.txt");
    expect(result.sectionCount).toBeGreaterThan(0);
    expect(result.detectedLanguage).toBe("en");
  });

  it("rejects oversized and unsupported files", () => {
    expect(
      importLegalFile({
        filename: "big.txt",
        bytes: Buffer.alloc(8 * 1024 * 1024 + 1, 97),
      }).code
    ).toBe("too_large");
    expect(
      importLegalFile({
        filename: "virus.exe",
        bytes: Buffer.from("MZ"),
      }).code
    ).toBe("unsupported");
  });
});
