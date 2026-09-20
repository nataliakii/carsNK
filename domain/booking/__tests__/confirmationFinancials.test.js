/**
 * The amounts shown to the partner and written into the immutable snapshot
 * are always recomputed on the server. A client-supplied total is never
 * trusted, and the prepayment is the fixed 10% product rule.
 */

import { resolveConfirmationFinancials } from "@/domain/booking/partnerBookingConfirmation";
import { BOOKING_PREPAYMENT_PERCENT } from "@/domain/legal/legalSettings";

describe("server-side prepayment calculation", () => {
  it("uses the stored authoritative price when present", () => {
    const result = resolveConfirmationFinancials({
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 30000,
        prepaymentPercent: 10,
        prepaymentMinor: 3000,
        balanceMinor: 27000,
      },
    });

    expect(result).toMatchObject({
      currency: "EUR",
      grossMinor: 30000,
      prepaymentPercent: 10,
      prepaymentMinor: 3000,
      balanceMinor: 27000,
      supplierBalancePercent: 90,
    });
  });

  it("derives 10% itself when only the gross amount is stored", () => {
    const result = resolveConfirmationFinancials({
      authoritativePrice: { currency: "EUR", grossMinor: 45500 },
    });

    expect(result.prepaymentPercent).toBe(BOOKING_PREPAYMENT_PERCENT);
    expect(result.prepaymentMinor).toBe(4550);
    expect(result.balanceMinor).toBe(40950);
    expect(result.prepaymentMinor + result.balanceMinor).toBe(result.grossMinor);
  });

  it("falls back to the stored order total, not to any client value", () => {
    const result = resolveConfirmationFinancials({ totalPrice: 250 });

    expect(result.grossMinor).toBe(25000);
    expect(result.prepaymentMinor).toBe(2500);
    expect(result.balanceMinor).toBe(22500);
  });

  it("prefers an admin override price over the calculated total", () => {
    const result = resolveConfirmationFinancials({
      totalPrice: 250,
      OverridePrice: 200,
    });

    expect(result.grossMinor).toBe(20000);
    expect(result.prepaymentMinor).toBe(2000);
  });

  it("never produces a negative amount", () => {
    const result = resolveConfirmationFinancials({
      authoritativePrice: { grossMinor: -100, prepaymentMinor: -50 },
    });

    expect(result.prepaymentMinor).toBeGreaterThanOrEqual(0);
    expect(result.balanceMinor).toBeGreaterThanOrEqual(0);
  });

  it("ignores any price supplied alongside the order object", () => {
    const order = {
      authoritativePrice: { currency: "EUR", grossMinor: 30000 },
      // A hostile client might try to smuggle these in.
      clientTotal: 1,
      prepaymentMinor: 1,
    };
    const result = resolveConfirmationFinancials(order);

    expect(result.grossMinor).toBe(30000);
    expect(result.prepaymentMinor).toBe(3000);
  });
});
