jest.mock("@lib/database", () => ({
  connectToDB: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn().mockResolvedValue(null),
  rentalQuoteRateLimitOptions: jest.fn().mockReturnValue({}),
}));
jest.mock("../../quotePublicRentalCar", () => ({
  jsonResponse: ({ status, body }) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  quotePublicRentalCar: jest.fn(),
}));

const {
  consumePublicPostOrError,
} = require("@/services/publicPostRateLimit");
const { quotePublicRentalCar } = require("../../quotePublicRentalCar");
const { POST } = require("../route");

describe("SEARCH_FIRST catalog quote route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumePublicPostOrError.mockResolvedValue(null);
    quotePublicRentalCar.mockImplementation(async ({ carId }) => ({
      status: 200,
      body: { totalPrice: carId === "car-a" ? 105 : 240, days: 4, available: true },
    }));
  });

  test("one POST prices every requested car and consumes the limiter once", async () => {
    const request = new Request("http://localhost/api/order/calcTotalPrice/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carIds: ["car-a", "car-b", "car-a"],
        rentalStartDate: "2026-10-20",
        rentalEndDate: "2026-10-24",
        placeIn: "Barcelona",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(consumePublicPostOrError).toHaveBeenCalledTimes(1);
    expect(quotePublicRentalCar).toHaveBeenCalledTimes(2);
    expect(body.ok).toBe(true);
    expect(body.quotes["car-a"].totalPrice).toBe(105);
    expect(body.quotes["car-b"].totalPrice).toBe(240);
  });

  test("an incomplete range is rejected without quoting", async () => {
    const request = new Request("http://localhost/api/order/calcTotalPrice/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carIds: ["car-a"],
        rentalStartDate: "2026-10-20",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(quotePublicRentalCar).not.toHaveBeenCalled();
  });
});
