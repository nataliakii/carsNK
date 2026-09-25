/**
 * @jest-environment node
 *
 * A crafted POST naming a legacy Greek place must not create a transfer on the
 * Spanish market. Filtering the dropdown in React is not the protection.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({
  sendTelegramDirect: jest.fn(async () => undefined),
}));
jest.mock("@/domain/transfers/notifyTransferEmails", () => ({
  notifyTransferEmails: jest.fn(async () => undefined),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(async () => null),
  transferRateLimitOptions: jest.fn(() => ({ tableName: "transferRateLimit" })),
}));
jest.mock("@models/Transfer", () => {
  const actual = jest.requireActual("@models/Transfer");
  return {
    ...actual,
    __esModule: true,
    default: { create: jest.fn() },
  };
});
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({ select: () => ({ lean: async () => null }) })),
  },
}));
jest.mock("@/domain/transfers/pricingEngine", () => ({
  calculateTransferQuote: jest.fn(async () => ({
    ok: true,
    quote: { customerPriceMinor: 5000, currency: "EUR" },
    route: { distanceKm: 30, durationMinutes: 35 },
    vehicleCategory: "STANDARD",
  })),
}));

import Transfer from "@models/Transfer";
import { calculateTransferQuote } from "@/domain/transfers/pricingEngine";
import { POST } from "../route";

const GREEK_PLACES = [
  "Afitos",
  "Agios Nikolaos Halkidiki",
  "Fourka",
  "Halkidiki",
  "Hanioti",
  "Kallithea",
  "Kassandra",
  "Kassandria",
  "Kriopigi",
];

function transferRequest(body, host = "rovaro.es") {
  return new Request(`https://${host}/api/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides = {}) {
  return {
    from: "Barcelona Airport",
    to: "Lloret de Mar",
    datetime: "2030-06-01T10:00",
    adults: 2,
    email: "traveller@example.com",
    customerName: "A Traveller",
    ...overrides,
  };
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
  Transfer.create.mockImplementation(async (doc) => ({
    ...doc,
    _id: { toString: () => "transfer-1" },
    toObject: () => doc,
  }));
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

describe("POST /api/transfers on the Spanish market", () => {
  test.each(GREEK_PLACES)("refuses %s as a pickup and creates nothing", async (place) => {
    const res = await POST(transferRequest(validBody({ from: place })));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.code).toBe("out_of_market");
    expect(Transfer.create).not.toHaveBeenCalled();
    expect(calculateTransferQuote).not.toHaveBeenCalled();
  });

  test("refuses a Greek dropoff", async () => {
    const res = await POST(transferRequest(validBody({ to: "Pefkohori" })));
    expect(res.status).toBe(422);
    expect(Transfer.create).not.toHaveBeenCalled();
  });

  test("refuses a claimed country other than the market", async () => {
    const res = await POST(transferRequest(validBody({ country: "GR" })));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe("out_of_market");
    expect(Transfer.create).not.toHaveBeenCalled();
  });

  test("refuses a Greek city hidden in the origin snapshot", async () => {
    const res = await POST(
      transferRequest(
        validBody({
          origin: { placeName: "Barcelona Airport", city: "Kriopigi" },
        })
      )
    );
    expect(res.status).toBe(422);
    expect(Transfer.create).not.toHaveBeenCalled();
  });

  test("accepts an in-market transfer and stamps it ES", async () => {
    const res = await POST(transferRequest(validBody()));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(Transfer.create).toHaveBeenCalledTimes(1);
    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.country).toBe("ES");
    expect(saved.origin.country).toBe("ES");
    expect(saved.destination.country).toBe("ES");
  });
});

describe("POST /api/transfers on the Greek market", () => {
  test("the legacy Greek flow still works where it is legitimately used", async () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    const res = await POST(
      transferRequest(
        validBody({ from: "Thessaloniki Airport", to: "Kriopigi" }),
        "carsnk.gr"
      )
    );

    expect(res.status).toBe(201);
    expect(Transfer.create).toHaveBeenCalledTimes(1);
    expect(Transfer.create.mock.calls[0][0].country).toBe("GR");
  });
});
