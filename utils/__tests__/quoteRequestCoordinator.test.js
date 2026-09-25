/**
 * "Too many requests" came from N cards each firing a quote for the same
 * range. These tests pin the two guarantees that stop it: identical requests
 * share one flight, and a repeat (including React Strict Mode's double effect)
 * never reaches the action twice.
 */

import { createQuoteCoordinator } from "../quoteRequestCoordinator";

const REQUEST = {
  carId: "car-a",
  startDate: "2026-10-20",
  endDate: "2026-10-24",
  placeIn: "Barcelona",
  placeOut: "Barcelona",
};

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("quote request coordinator", () => {
  test("one completed range triggers one logical quote request", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({ fetchQuote });

    await coordinator.request(REQUEST);

    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(coordinator.callCount).toBe(1);
  });

  test("concurrent identical requests are deduplicated into one call", async () => {
    const gate = deferred();
    const fetchQuote = jest.fn().mockReturnValue(gate.promise);
    const coordinator = createQuoteCoordinator({ fetchQuote });

    const a = coordinator.request(REQUEST);
    const b = coordinator.request(REQUEST);
    const c = coordinator.request(REQUEST);

    gate.resolve({ ok: true, totalPrice: 105 });
    const results = await Promise.all([a, b, c]);

    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.totalPrice === 105)).toBe(true);
  });

  test("a rerender does not create a duplicate request", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({ fetchQuote });

    // Ten renders of the same card with the same inputs.
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await coordinator.request(REQUEST);
    }

    expect(fetchQuote).toHaveBeenCalledTimes(1);
  });

  test("deduplication stays safe under React Strict Mode double effects", async () => {
    const gate = deferred();
    const fetchQuote = jest.fn().mockReturnValue(gate.promise);
    const coordinator = createQuoteCoordinator({ fetchQuote });

    // Strict Mode runs the effect body twice back to back on mount.
    const first = coordinator.request(REQUEST);
    const second = coordinator.request(REQUEST);
    expect(fetchQuote).toHaveBeenCalledTimes(1);

    gate.resolve({ ok: true, totalPrice: 105 });
    await Promise.all([first, second]);

    // The remount pass hits the cache, still one call.
    await coordinator.request(REQUEST);
    expect(fetchQuote).toHaveBeenCalledTimes(1);
  });

  test("different cars and different ranges are separate requests", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({ fetchQuote });

    await coordinator.request(REQUEST);
    await coordinator.request({ ...REQUEST, carId: "car-b" });
    await coordinator.request({ ...REQUEST, endDate: "2026-10-25" });
    await coordinator.request({ ...REQUEST, placeIn: "Girona" });

    expect(fetchQuote).toHaveBeenCalledTimes(4);
  });

  test("an incomplete range never reaches the action", async () => {
    const fetchQuote = jest.fn();
    const coordinator = createQuoteCoordinator({ fetchQuote });

    expect(await coordinator.request({ carId: "car-a", startDate: "2026-10-20" })).toBeNull();
    expect(await coordinator.request({ carId: "", ...REQUEST, carId: "" })).toBeNull();
    // end before start is not a range
    expect(
      await coordinator.request({ ...REQUEST, endDate: "2026-10-01" })
    ).toBeNull();

    expect(fetchQuote).not.toHaveBeenCalled();
  });

  test("failures are not cached, so a retry can genuinely retry", async () => {
    const fetchQuote = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "boom" })
      .mockResolvedValueOnce({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({ fetchQuote });

    expect((await coordinator.request(REQUEST)).ok).toBe(false);
    expect((await coordinator.request(REQUEST)).totalPrice).toBe(105);
    expect(fetchQuote).toHaveBeenCalledTimes(2);
  });

  test("cached quotes expire and can be invalidated per car", async () => {
    let clock = 0;
    const fetchQuote = jest.fn().mockResolvedValue({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({
      fetchQuote,
      ttlMs: 1000,
      now: () => clock,
    });

    await coordinator.request(REQUEST);
    clock = 500;
    await coordinator.request(REQUEST);
    expect(fetchQuote).toHaveBeenCalledTimes(1);

    clock = 2000;
    await coordinator.request(REQUEST);
    expect(fetchQuote).toHaveBeenCalledTimes(2);

    coordinator.invalidate("car-a");
    await coordinator.request(REQUEST);
    expect(fetchQuote).toHaveBeenCalledTimes(3);
  });

  test("invalidating one car leaves another car's cache intact", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ ok: true, totalPrice: 105 });
    const coordinator = createQuoteCoordinator({ fetchQuote });

    await coordinator.request(REQUEST);
    await coordinator.request({ ...REQUEST, carId: "car-b" });
    expect(fetchQuote).toHaveBeenCalledTimes(2);

    coordinator.invalidate("car-a");
    await coordinator.request({ ...REQUEST, carId: "car-b" });
    expect(fetchQuote).toHaveBeenCalledTimes(2);
  });
});
