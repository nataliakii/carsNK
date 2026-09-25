import { snapshotAcceptedDocuments } from "@/domain/legal/agreementService";

describe("partner package acceptance snapshot", () => {
  test("copies the three document ids, versions, languages and checksums", () => {
    const live = [
      {
        documentType: "partner-agreement",
        language: "en",
        jurisdiction: "EU",
        version: 3,
        checksum: "aaa",
        pk: "DOC#partner-agreement",
        sk: "v3#en",
        renderedTitle: "Partner Agreement",
        renderedSections: [{ id: "1", heading: "Parties", text: "Body" }],
      },
      {
        documentType: "partner-operating-rules",
        language: "en",
        jurisdiction: "EU",
        version: 2,
        checksum: "bbb",
        pk: "DOC#partner-operating-rules",
        sk: "v2#en",
        renderedTitle: "Partner Operating Rules",
        renderedSections: [],
      },
      {
        documentType: "data-protection-schedule",
        language: "en",
        jurisdiction: "EU",
        version: 4,
        checksum: "ccc",
        pk: "DOC#data-protection-schedule",
        sk: "v4#en",
        renderedTitle: "Data Protection Schedule",
        renderedSections: [],
      },
    ];

    const snap = snapshotAcceptedDocuments(live);
    live[0].version = 99;
    live[0].checksum = "changed";
    live[0].renderedSections[0].text = "changed";

    expect(snap.map((doc) => doc.renderedTitle)).toEqual([
      "Partner Agreement",
      "Partner Operating Rules",
      "Data Protection Schedule",
    ]);
    expect(snap.map((doc) => doc.pk)).toEqual([
      "DOC#partner-agreement",
      "DOC#partner-operating-rules",
      "DOC#data-protection-schedule",
    ]);
    expect(snap.map((doc) => doc.version)).toEqual([3, 2, 4]);
    expect(snap.map((doc) => doc.language)).toEqual(["en", "en", "en"]);
    expect(snap.map((doc) => doc.checksum)).toEqual(["aaa", "bbb", "ccc"]);
    expect(snap[0].renderedSections[0].text).toBe("Body");
  });
});
