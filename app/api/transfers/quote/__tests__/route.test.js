/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({
  connectToDB: jest.fn(),
}));

jest.mock("@/domain/transfers/createTransferOrder", () => {
  const actual = jest.requireActual("@/domain/transfers/createTransferOrder");
  return {
    ...actual,
    previewTransferQuote: jest.fn(),
  };
});

jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  quoteRateLimitOptions: jest.fn(() => ({ tableName: "transferQuoteRateLimit" })),
}));

import { connectToDB } from "@lib/database";
import { previewTransferQuote } from "@/domain/transfers/createTransferOrder";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { POST } from "../route";

function quoteRequest(body, { headers } = {}) {
  return new Request("https://carsnk.gr/api/transfers/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

const validBody = {
  from: "Thessaloniki Airport",
  to: "Thessaloniki center",
  country: "GR",
};

describe("POST /api/transfers/quote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectToDB.mockResolvedValue(undefined);
    consumePublicPostOrError.mockResolvedValue(null);
    previewTransferQuote.mockResolvedValue({
      ok: true,
      quote: {
        customerPriceMinor: 4500,
        currency: "EUR",
        distanceKm: 16,
      },
      route: { distanceKm: 16, durationMinutes: 22, fromCache: false },
      vehicleCategory: "SEDAN",
    });
  });

  test("returns a quote within the rate limit", async () => {
    const res = await POST(quoteRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.quote.customerPriceMinor).toBe(4500);
    expect(previewTransferQuote).toHaveBeenCalledTimes(1);
  });

  test("returns 429 when the quote limit is exceeded", async () => {
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, message: "Too many requests", code: "RATE_LIMIT" },
    });
    const res = await POST(quoteRequest(validBody));
    expect(res.status).toBe(429);
    expect(previewTransferQuote).not.toHaveBeenCalled();
  });

  test("rejects invalid input", async () => {
    const missing = await POST(quoteRequest({ from: "A" }));
    expect(missing.status).toBe(400);

    const badCountry = await POST(
      quoteRequest({ ...validBody, country: "US" })
    );
    expect(badCountry.status).toBe(400);

    const badCoords = await POST(
      quoteRequest({
        ...validBody,
        origin: { lat: 999, lng: 10 },
      })
    );
    expect(badCoords.status).toBe(400);

    const tooLong = await POST(
      quoteRequest({ ...validBody, from: "x".repeat(201) })
    );
    expect(tooLong.status).toBe(400);
    expect(previewTransferQuote).not.toHaveBeenCalled();
  });

  test("maps provider failure without leaking internals", async () => {
    previewTransferQuote.mockRejectedValue(
      new Error("Google status REQUEST_DENIED key=AIzaSyFakeKeyValue")
    );
    const res = await POST(quoteRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/AIza/);
    expect(JSON.stringify(body)).not.toMatch(/key=/);
    expect(body.message).toBe("Quote failed");
  });

  test("does not treat client-provided distance as authoritative", async () => {
    const res = await POST(
      quoteRequest({
        ...validBody,
        distanceKm: 1,
        durationMinutes: 1,
        customerPriceMinor: 1,
      })
    );
    expect(res.status).toBe(200);
    const passed = previewTransferQuote.mock.calls[0][0];
    expect(passed.distanceKm).toBeUndefined();
    expect(passed.durationMinutes).toBeUndefined();
    expect(passed.customerPriceMinor).toBeUndefined();
    expect(passed.from).toBe(validBody.from);
  });

  test("never returns an API key to the client", async () => {
    previewTransferQuote.mockResolvedValue({
      ok: false,
      message: "GOOGLE_MAPS_API_KEY is not configured AIzaSyClientLeak",
    });
    const res = await POST(quoteRequest(validBody));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/AIza/);
    expect(JSON.stringify(body)).not.toMatch(/GOOGLE_MAPS_API_KEY/);
    expect(body.message).toBe("Distance provider unavailable");
  });
});
