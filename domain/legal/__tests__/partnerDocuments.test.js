import {
  resolvePartnerDocumentResourceType,
  resourceTypeFromStorageRef,
} from "../partnerDocuments";

describe("partner document resource type", () => {
  it("keeps the type saved at upload", () => {
    expect(
      resolvePartnerDocumentResourceType({
        storageRef: "rovaro/partners/x/legal/abc",
        label: "scan.jpg",
        resourceType: "raw",
      })
    ).toBe("raw");
  });

  it("treats a PDF filename as raw when Cloudinary omitted the extension", () => {
    expect(
      resolvePartnerDocumentResourceType({
        storageRef: "rovaro/partners/x/legal/tw73mrjlbgxciq79xl53",
        label: "EIRE.pdf",
      })
    ).toBe("raw");
  });

  it("treats an extensionless image as an image", () => {
    expect(
      resourceTypeFromStorageRef("rovaro/partners/x/legal/photo", "photo.jpg")
    ).toBe("image");
  });

  it("still recognises a raw public id that ends in .pdf", () => {
    expect(resourceTypeFromStorageRef("folder/registry.pdf")).toBe("raw");
  });
});
