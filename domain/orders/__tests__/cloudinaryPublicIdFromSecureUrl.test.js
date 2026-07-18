import { cloudinaryPublicIdFromSecureUrl } from "../cloudinaryPublicIdFromSecureUrl";

describe("cloudinaryPublicIdFromSecureUrl", () => {
  it("returns null for non-strings and non-cloudinary URLs", () => {
    expect(cloudinaryPublicIdFromSecureUrl(null)).toBeNull();
    expect(cloudinaryPublicIdFromSecureUrl("https://example.com/x")).toBeNull();
  });

  it("parses URL with version segment (typical upload)", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1700000000/car/orders/john-2026-03-15/driving-licence/abc12.jpg";
    expect(cloudinaryPublicIdFromSecureUrl(url)).toBe(
      "car/orders/john-2026-03-15/driving-licence/abc12"
    );
  });

  it("strips transformation segments before version", () => {
    const url =
      "https://res.cloudinary.com/x/image/upload/c_fill,w_200/v99/folder/name.png";
    expect(cloudinaryPublicIdFromSecureUrl(url)).toBe("folder/name");
  });

  it("parses URL without explicit transforms (only version)", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/a/b.webp";
    expect(cloudinaryPublicIdFromSecureUrl(url)).toBe("a/b");
  });
});
