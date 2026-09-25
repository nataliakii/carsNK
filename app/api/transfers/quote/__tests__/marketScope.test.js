/**
 * @jest-environment node
 *
 * Reading a price for an out-of-market place is refused before any provider
 * call, so a crafted quote cannot be used to discover Greek routes on rovaro.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/transfers/createTransferOrder", () => {
  const actual = jest.requireActual("@/domain/transfers/createTransferOrder");
  return { ...actual, previewTransferQuote: jest.fn() };
});
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(async () => null),
  quoteRateLimitOptions: jest.fn(() => ({ tableName: "transferQuoteRateLimit" })),
}));

import { connectToDB } from "@lib/database";
import { previewTransferQuote } from "@/domain/transfers/createTransferOrder";
import { POST } from "../route";

function quoteRequest(body, host = "rovaro.es") {
  return new Request(`https://${host}/api/transfers/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
  connectToDB.mockResolvedValue(undefined);
  previewTransferQuote.mockResolvedValue({
    ok: true,
    quote: { customerPriceMinor: 4500, currency: "EUR" },
    route: { distanceKm: 40, durationMinutes: 45 },
  });
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

test.each(["Afitos", "Halkidiki", "Kassandria", "Agios Nikolaos Halkidiki"])(
  "refuses to quote %s on the Spanish market",
  async (place) => {
    const res = await POST(quoteRequest({ from: place, to: "Barcelona" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("out_of_market");
    expect(previewTransferQuote).not.toHaveBeenCalled();
  }
);

test("refuses a GR country claim from a Spanish host", async () => {
  const res = await POST(
    quoteRequest({ from: "Barcelona", to: "Girona", country: "GR" })
  );
  expect(res.status).toBe(400);
  expect(previewTransferQuote).not.toHaveBeenCalled();
});

test("quotes an in-market trip and pins it to ES", async () => {
  const res = await POST(
    quoteRequest({ from: "Barcelona Airport", to: "Lloret de Mar" })
  );

  expect(res.status).toBe(200);
  expect(previewTransferQuote).toHaveBeenCalledTimes(1);
  expect(previewTransferQuote.mock.calls[0][0].country).toBe("ES");
  expect(previewTransferQuote.mock.calls[0][1]).toEqual({ marketCountry: "ES" });
});
