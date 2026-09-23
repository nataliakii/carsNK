import {
  canonicalize,
  computeDocumentChecksum,
  verifyDocumentChecksum,
  computeSnapshotChecksum,
} from "@/domain/legal/checksum";

function baseDoc() {
  return {
    platform: "rovaro",
    documentType: "partner-agreement",
    language: "en",
    jurisdiction: "EU",
    version: 1,
    status: "draft",
    updatedAt: new Date("2026-01-01"),
    content: {
      title: "Rovaro Partner Agreement",
      sections: [
        { id: "1", heading: "Parties", body: "The operator and the Supplier." },
        { id: "2", heading: "Prepayment", body: "{{settings.bookingPrepaymentPercent}}" },
      ],
    },
  };
}

describe("canonicalize", () => {
  it("is independent of key order", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("distinguishes arrays from objects", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize({ 0: 1, 1: 2 }));
  });
});

describe("document checksum", () => {
  it("is stable across repeated calls", () => {
    const doc = baseDoc();
    expect(computeDocumentChecksum(doc)).toBe(computeDocumentChecksum(doc));
  });

  it("ignores storage metadata such as status and updatedAt", () => {
    const a = baseDoc();
    const b = { ...baseDoc(), status: "published", updatedAt: new Date("2030-06-06") };
    expect(computeDocumentChecksum(a)).toBe(computeDocumentChecksum(b));
  });

  it("changes when a single character of the text changes", () => {
    const a = baseDoc();
    const b = baseDoc();
    b.content.sections[0].body = "The operator and the supplier.";
    expect(computeDocumentChecksum(a)).not.toBe(computeDocumentChecksum(b));
  });

  it("changes when the version changes", () => {
    const a = baseDoc();
    const b = { ...baseDoc(), version: 2 };
    expect(computeDocumentChecksum(a)).not.toBe(computeDocumentChecksum(b));
  });

  it("changes when sections are reordered", () => {
    const a = baseDoc();
    const b = baseDoc();
    b.content.sections.reverse();
    expect(computeDocumentChecksum(a)).not.toBe(computeDocumentChecksum(b));
  });

  it("detects a tampered stored document", () => {
    const doc = baseDoc();
    const checksum = computeDocumentChecksum(doc);

    doc.content.sections[1].body = "0%";
    const result = verifyDocumentChecksum(doc, checksum);

    expect(result.ok).toBe(false);
    expect(result.actual).not.toBe(result.expected);
  });
});

describe("snapshot checksum", () => {
  it("is stable and order independent for object keys", () => {
    const a = { orderId: "1", amount: 100 };
    const b = { amount: 100, orderId: "1" };
    expect(computeSnapshotChecksum(a)).toBe(computeSnapshotChecksum(b));
  });

  it("changes when any recorded value changes", () => {
    const a = computeSnapshotChecksum({ grossMinor: 10000 });
    const b = computeSnapshotChecksum({ grossMinor: 10001 });
    expect(a).not.toBe(b);
  });
});
