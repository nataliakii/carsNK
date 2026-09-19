/**
 * @jest-environment node
 */
import {
  assertValidCoordinates,
  validatePublicQuoteRequest,
} from "../validatePublicQuoteRequest";

describe("validatePublicQuoteRequest", () => {
  test("accepts GR place-name quotes and drops client km", () => {
    const result = validatePublicQuoteRequest({
      from: "SKG",
      to: "Thessaloniki",
      country: "GR",
      distanceKm: 999,
      customerPriceMinor: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.payload.distanceKm).toBeUndefined();
    expect(result.payload.customerPriceMinor).toBeUndefined();
    expect(result.payload.country).toBe("GR");
  });

  test("accepts ES and rejects unknown countries", () => {
    expect(
      validatePublicQuoteRequest({
        from: "BCN",
        to: "Sitges",
        country: "ES",
      }).ok
    ).toBe(true);
    expect(
      validatePublicQuoteRequest({
        from: "JFK",
        to: "Manhattan",
        country: "US",
      }).ok
    ).toBe(false);
  });

  test("rejects malformed coordinates", () => {
    expect(assertValidCoordinates("abc", 10, "origin").ok).toBe(false);
    expect(assertValidCoordinates(91, 10, "origin").ok).toBe(false);
    expect(assertValidCoordinates(40.6, 22.9, "origin").ok).toBe(true);
  });
});
