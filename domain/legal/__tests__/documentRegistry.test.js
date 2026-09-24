/**
 * Built-in Rovaro legal documents: completeness, checksum stability, tenant
 * scoping and the absence of invented legal data.
 */

import {
  getSeedDocuments,
  getSeedDocument,
  normalizeSeedDocument,
} from "@/domain/legal/documentRegistry";
import {
  ALL_LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_STATUS,
  LEGAL_PLATFORM,
} from "@/domain/legal/documentTypes";
import { computeDocumentChecksum } from "@/domain/legal/checksum";
import { isRovaroDocumentKey } from "@/domain/legal/documentKeys";

const LANGUAGES = ["en", "es"];

describe("document registry", () => {
  const docs = getSeedDocuments();

  it("ships English and Spanish for all six document types", () => {
    expect(ALL_LEGAL_DOCUMENT_TYPES).toHaveLength(6);
    for (const documentType of ALL_LEGAL_DOCUMENT_TYPES) {
      for (const language of LANGUAGES) {
        const doc = docs.find(
          (d) => d.documentType === documentType && d.language === language
        );
        expect(doc).toBeDefined();
        expect(doc.content.sections.length).toBeGreaterThan(5);
      }
    }
    expect(docs).toHaveLength(12);
  });

  it("scopes every document to the rovaro platform", () => {
    for (const doc of docs) {
      expect(doc.platform).toBe(LEGAL_PLATFORM);
      expect(doc.pk.startsWith("PLATFORM#rovaro#DOC#")).toBe(true);
      expect(isRovaroDocumentKey(doc.pk)).toBe(true);
    }
  });

  it("uses the documented sort key layout", () => {
    const doc = getSeedDocument("partner-agreement", "en");
    expect(doc.pk).toBe("PLATFORM#rovaro#DOC#partner-agreement");
    expect(doc.sk).toBe("LANG#en#JUR#EU#VERSION#1");
  });

  it("seeds everything as a draft — publishing is a deliberate action", () => {
    for (const doc of docs) {
      expect(doc.status).toBe(LEGAL_DOCUMENT_STATUS.DRAFT);
      expect(doc.effectiveFrom).toBeNull();
    }
  });

  it("gives every document a stable checksum", () => {
    for (const doc of docs) {
      expect(doc.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(computeDocumentChecksum(doc)).toBe(doc.checksum);
    }
  });

  it("produces a unique checksum per document and language", () => {
    const checksums = new Set(docs.map((d) => d.checksum));
    expect(checksums.size).toBe(docs.length);
  });

  it("keeps section ids parallel between English and Spanish", () => {
    for (const documentType of ALL_LEGAL_DOCUMENT_TYPES) {
      const en = getSeedDocument(documentType, "en");
      const es = getSeedDocument(documentType, "es");
      expect(es.content.sections.map((s) => s.id)).toEqual(
        en.content.sections.map((s) => s.id)
      );
    }
  });

  it("falls back to English for an unsupported language", () => {
    const doc = getSeedDocument("privacy-policy", "de");
    expect(doc.language).toBe("en");
  });

  it("rejects an unknown document type", () => {
    expect(() =>
      normalizeSeedDocument({ documentType: "bbqr-terms", language: "en" })
    ).toThrow(/Unknown legal document type/);
  });
});

describe("no invented legal data in document content", () => {
  const docs = getSeedDocuments();
  const allText = docs
    .flatMap((doc) => [
      doc.content.title,
      ...doc.content.sections.flatMap((s) => [s.heading, s.body]),
    ])
    .join("\n");

  it("contains no bracketed placeholders", () => {
    expect(allText).not.toMatch(/\[\s*(INSERT|TBD|TODO|XXX)/i);
    expect(allText).not.toMatch(/<<[^>]*>>/);
  });

  it("never turns the sole trader into a company", () => {
    expect(allText).not.toMatch(/NK Platform Studio (Ltd|Limited)/i);
    expect(allText).not.toMatch(/Rovaro (Ltd|Limited|GmbH|S\.L\.)/i);
  });

  it("never states a CRO, VAT or tax reference number literally", () => {
    // Irish VAT format, CRO numbers and tax reference numbers.
    expect(allText).not.toMatch(/\bIE\s?\d{7}[A-W]{1,2}\b/);
    expect(allText).not.toMatch(/\bCRO\s*(No\.?|number)?\s*:?\s*\d{4,}/i);
    expect(allText).not.toMatch(/\bTax Reference Number\s*:?\s*\d/i);
  });

  it("never states a Spanish NIF/CIF or a phone number for the operator", () => {
    expect(allText).not.toMatch(/\b[ABCDEFGHJNPQRSUVW]-?\d{7}[0-9A-J]\b/);
    expect(allText).not.toMatch(/\+353\s?\d/);
    expect(allText).not.toMatch(/\+34\s?\d/);
  });

  it("keeps the operator address as a token, never as literal text", () => {
    for (const doc of getSeedDocuments()) {
      for (const section of doc.content.sections) {
        if ((section.requires || []).includes("businessAddress")) {
          expect(section.body).toContain("{{operator.businessAddress}}");
        }
      }
    }
  });

  it("does not include a legal-review disclaimer in any seed document", () => {
    for (const doc of getSeedDocuments()) {
      const text = doc.content.sections
        .map((s) => `${s.heading} ${s.body}`)
        .join("\n")
        .toLowerCase();
      expect(text).not.toMatch(/legal review status|estado de revisión (jurídica|legal)/);
      expect(text).not.toMatch(/requires professional legal review/);
      expect(text).not.toMatch(/not be relied upon as final/);
      expect(text).not.toMatch(/carece de eficacia contractual/);
    }
  });
});

describe("BBQR and other platforms are out of scope", () => {
  it("rejects a partition key from another platform", () => {
    expect(isRovaroDocumentKey("PLATFORM#bbqr#DOC#privacy-policy")).toBe(false);
    expect(isRovaroDocumentKey("PLATFORM#carsnk#DOC#terms-of-service")).toBe(
      false
    );
  });

  it("never produces a key outside the rovaro partition", () => {
    for (const doc of getSeedDocuments()) {
      expect(doc.pk).not.toMatch(/PLATFORM#(?!rovaro#)/);
    }
  });
});
