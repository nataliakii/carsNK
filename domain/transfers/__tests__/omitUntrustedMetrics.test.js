/**
 * @jest-environment node
 */
import { omitUntrustedTransferMetrics } from "../createTransferOrder";

describe("omitUntrustedTransferMetrics", () => {
  test("drops client km, duration, base km and prices", () => {
    const safe = omitUntrustedTransferMetrics({
      from: "A",
      to: "B",
      email: "x@y.z",
      distanceKm: 999,
      durationMinutes: 1,
      baseFromDistanceKm: 50,
      baseFromDurationMinutes: 12,
      baseToDistanceKm: 40,
      baseToDurationMinutes: 10,
      quoteSnapshot: { customerPriceMinor: 1 },
      customerPriceMinor: 1,
      supplierPayoutMinor: 1,
    });
    expect(safe.from).toBe("A");
    expect(safe.to).toBe("B");
    expect(safe.email).toBe("x@y.z");
    expect(safe.distanceKm).toBeUndefined();
    expect(safe.durationMinutes).toBeUndefined();
    expect(safe.baseFromDistanceKm).toBeUndefined();
    expect(safe.baseToDistanceKm).toBeUndefined();
    expect(safe.quoteSnapshot).toBeUndefined();
    expect(safe.customerPriceMinor).toBeUndefined();
  });
});
