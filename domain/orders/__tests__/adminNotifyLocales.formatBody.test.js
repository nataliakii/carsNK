import { formatAdminNotificationBody } from "../adminNotifyLocales";

function createOrderCreatedPayload(overrides = {}) {
  return {
    intent: "ORDER_CREATED",
    orderNumber: "1001",
    orderId: "o1",
    carModel: "Toyota Yaris",
    regNumber: "AA-1234",
    rentalStartDate: "2026-01-15T22:00:00.000Z",
    rentalEndDate: "2026-01-17T22:00:00.000Z",
    timeIn: "2026-01-15T12:00:00.000Z",
    timeOut: "2026-01-17T10:00:00.000Z",
    placeIn: "Airport",
    placeOut: "City",
    numberOfDays: 2,
    totalPrice: 199,
    insurance: "TPL",
    drivingLicenceUrls: [],
    ...overrides,
  };
}

describe("formatAdminNotificationBody ORDER_CREATED", () => {
  it("includes driving licence not uploaded when there are no valid URLs", () => {
    const body = formatAdminNotificationBody(
      createOrderCreatedPayload({ drivingLicenceUrls: [] }),
      "New client order created",
      "en",
      { includeDrivingLicenceInfo: true }
    );
    expect(body).toContain("🪪 Driver's licence: not uploaded");
  });

  it("includes uploaded status and Cloudinary URLs when photos exist", () => {
    const lic =
      "https://res.cloudinary.com/demo/image/upload/v1/order/licence.jpg";
    const body = formatAdminNotificationBody(
      createOrderCreatedPayload({ drivingLicenceUrls: [lic] }),
      "New client order created",
      "en",
      { includeDrivingLicenceInfo: true }
    );
    expect(body).toContain("🪪 Driver's licence: uploaded");
    expect(body).toContain(lic);
    expect(body).toContain("🪪 Driver's licence:");
  });

  it("keeps uploaded status without exposing URLs when only upload flag is present", () => {
    const body = formatAdminNotificationBody(
      createOrderCreatedPayload({
        drivingLicenceUrls: [],
        hasDrivingLicenceUpload: true,
      }),
      "New client order created",
      "en",
      { includeDrivingLicenceInfo: true }
    );
    expect(body).toContain("Driver's licence: uploaded");
    expect(body).not.toContain("Photo 1");
  });

  it("uses Russian strings for ru locale", () => {
    const lic =
      "https://res.cloudinary.com/demo/image/upload/v1/a/b.jpg";
    const body = formatAdminNotificationBody(
      createOrderCreatedPayload({ drivingLicenceUrls: [lic] }),
      "New client order created",
      "ru",
      { includeDrivingLicenceInfo: true }
    );
    expect(body).toContain("🪪 Водительские права: загружены");
  });

  it("omits driving licence block completely when licence info is disabled", () => {
    const lic =
      "https://res.cloudinary.com/demo/image/upload/v1/order/licence.jpg";
    const body = formatAdminNotificationBody(
      createOrderCreatedPayload({
        drivingLicenceUrls: [lic],
        hasDrivingLicenceUpload: true,
      }),
      "New client order created",
      "en",
      { includeDrivingLicenceInfo: false }
    );
    expect(body).not.toContain("Driver's licence");
    expect(body).not.toContain(lic);
  });
});

describe("formatAdminNotificationBody non-create (e.g. Telegram update)", () => {
  it("includes licence status line before action", () => {
    const body = formatAdminNotificationBody(
      {
        intent: "CRITICAL_EDIT",
        orderNumber: "55",
        orderId: "id",
        carModel: "X",
        regNumber: "R1",
        action: "UPDATE_DATES",
        source: "BACKEND",
        drivingLicenceUrls: [],
      },
      "CRITICAL: CRITICAL_EDIT on confirmed client order",
      "en",
      { includeDrivingLicenceInfo: true }
    );
    expect(body).toContain("🪪 Driver's licence: not uploaded");
    expect(body).toContain("Action: UPDATE_DATES");
    const carIdx = body.indexOf("Car:");
    const statusIdx = body.indexOf("🪪 Driver's licence:");
    const actionIdx = body.indexOf("Action:");
    expect(statusIdx).toBeGreaterThan(carIdx);
    expect(actionIdx).toBeGreaterThan(statusIdx);
  });

  it("omits licence status line when licence info is disabled", () => {
    const body = formatAdminNotificationBody(
      {
        intent: "CRITICAL_EDIT",
        orderNumber: "55",
        orderId: "id",
        carModel: "X",
        regNumber: "R1",
        action: "UPDATE_DATES",
        source: "BACKEND",
        drivingLicenceUrls: [],
      },
      "CRITICAL: CRITICAL_EDIT on confirmed client order",
      "en",
      { includeDrivingLicenceInfo: false }
    );
    expect(body).not.toContain("Driver's licence");
    expect(body).toContain("Action: UPDATE_DATES");
  });
});
