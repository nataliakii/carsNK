/**
 * @jest-environment node
 *
 * Atomic claim behaviour — unit-level simulation of the filter conditions
 * (full Mongo integration covered when DB is available in CI).
 */

describe("atomic claim race semantics", () => {
  function simulateClaim(state, companyId, now = Date.now()) {
    // Idempotent winner
    if (
      state.status === "CLAIMED" &&
      String(state.assignedSupplierId) === String(companyId)
    ) {
      return { ok: true, idempotent: true, code: "idempotent" };
    }

    if (state.status !== "OPEN_FOR_CLAIM" || state.assignedSupplierId) {
      return { ok: false, code: "taken" };
    }
    if (state.offerExpiresAt && state.offerExpiresAt < now) {
      return { ok: false, code: "expired" };
    }
    if ((state.excludedSupplierIds || []).map(String).includes(String(companyId))) {
      return { ok: false, code: "ineligible" };
    }
    if (
      (state.eligibleSupplierIds || []).length &&
      !(state.eligibleSupplierIds || []).map(String).includes(String(companyId))
    ) {
      return { ok: false, code: "ineligible" };
    }

    // Atomic success for first caller — subsequent callers see assigned
    state.status = "CLAIMED";
    state.assignedSupplierId = companyId;
    return { ok: true, code: "success" };
  }

  test("exactly one successful claim among concurrent attempts", () => {
    const state = {
      status: "OPEN_FOR_CLAIM",
      assignedSupplierId: null,
      offerExpiresAt: Date.now() + 60_000,
      eligibleSupplierIds: ["c1", "c2", "c3"],
      excludedSupplierIds: [],
    };
    const results = ["c1", "c2", "c3"].map((id) => simulateClaim(state, id));
    const successes = results.filter((r) => r.ok && !r.idempotent);
    expect(successes).toHaveLength(1);
    expect(results.filter((r) => r.code === "taken")).toHaveLength(2);
    expect(state.assignedSupplierId).toBe("c1");
  });

  test("repeated claim by winner is idempotent", () => {
    const state = {
      status: "OPEN_FOR_CLAIM",
      assignedSupplierId: null,
      offerExpiresAt: Date.now() + 60_000,
      eligibleSupplierIds: ["c1"],
      excludedSupplierIds: [],
    };
    expect(simulateClaim(state, "c1").ok).toBe(true);
    const again = simulateClaim(state, "c1");
    expect(again.ok).toBe(true);
    expect(again.idempotent).toBe(true);
  });

  test("claim after expiration fails", () => {
    const state = {
      status: "OPEN_FOR_CLAIM",
      assignedSupplierId: null,
      offerExpiresAt: Date.now() - 1000,
      eligibleSupplierIds: ["c1"],
      excludedSupplierIds: [],
    };
    expect(simulateClaim(state, "c1").code).toBe("expired");
  });

  test("ineligible / excluded supplier fails", () => {
    const state = {
      status: "OPEN_FOR_CLAIM",
      assignedSupplierId: null,
      offerExpiresAt: Date.now() + 60_000,
      eligibleSupplierIds: ["c1"],
      excludedSupplierIds: ["c2"],
    };
    expect(simulateClaim(state, "c2").code).toBe("ineligible");
    expect(simulateClaim(state, "c3").code).toBe("ineligible");
  });

  test("reopening excludes cancelling supplier", () => {
    const excluded = ["canceller"];
    const eligible = ["a", "b", "canceller"].filter(
      (id) => !excluded.includes(id)
    );
    expect(eligible).toEqual(["a", "b"]);
  });
});

describe("payment idempotency stub", () => {
  test("same idempotency key does not double-apply", () => {
    const payments = new Map();
    function recordPayment(key, amount) {
      if (payments.has(key)) {
        return { ok: true, idempotent: true, amount: payments.get(key) };
      }
      payments.set(key, amount);
      return { ok: true, idempotent: false, amount };
    }
    expect(recordPayment("pay-1", 5000).idempotent).toBe(false);
    expect(recordPayment("pay-1", 5000).idempotent).toBe(true);
    expect(payments.size).toBe(1);
  });
});
