/**
 * @jest-environment node
 */
import {
  resolveCreateDrivingLicenceUrls,
  resolveCreateTotalPrice,
} from "../publicOrderCreatePolicy";

describe("publicOrderCreatePolicy", () => {
  test("public add ignores licence URLs", () => {
    expect(
      resolveCreateDrivingLicenceUrls({
        isAdminSession: false,
        raw: [
          "https://res.cloudinary.com/demo/image/upload/licence-front.jpg",
        ],
      })
    ).toEqual([]);
  });

  test("admin create keeps normalized licence URLs", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/licence-front.jpg";
    expect(
      resolveCreateDrivingLicenceUrls({
        isAdminSession: true,
        raw: [url],
      })
    ).toEqual([url]);
  });

  test("public add ignores client totalPrice and uses rental + delivery", () => {
    expect(
      resolveCreateTotalPrice({
        isAdminSession: false,
        clientTotalPrice: 1,
        rentalTotal: 100,
        deliveryTotal: 25,
      })
    ).toBe(125);
  });

  test("admin create may keep explicit total", () => {
    expect(
      resolveCreateTotalPrice({
        isAdminSession: true,
        clientTotalPrice: 999,
        rentalTotal: 100,
        deliveryTotal: 25,
      })
    ).toBe(999);
  });
});
