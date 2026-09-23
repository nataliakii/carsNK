import {
  assertLocationSnapshotForConfirm,
  buildLocationLeg,
  buildLocationSnapshot,
  LOCATION_KIND,
  snapshotFeesMatchAuthoritativePrice,
} from "../locationSnapshot";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";

const snapshot = buildLocationSnapshot({
  pickup: buildLocationLeg({
    kind: LOCATION_KIND.OFFICE,
    office: {
      _id: "64b7f2c3a1b2c3d4e5f60701",
      name: "Rovaro BCN",
      address: "Carrer de Mallorca 1",
    },
    feeMajor: 0,
  }),
  dropoff: buildLocationLeg({
    kind: LOCATION_KIND.DELIVERY,
    place: {
      placeId: "ChIJ",
      address: "Hotel Arts",
      locality: "Barcelona",
      country: "ES",
      lat: 41.38,
      lon: 2.19,
    },
    feeMajor: 25,
    ruleId: "cities",
    ruleVersion: "1",
  }),
});

describe("location snapshot", () => {
  test("existing order retains its location/pricing snapshot after rule edits", () => {
    const laterRule = { ...snapshot, pickup: { ...snapshot.pickup, feeMajor: 80 } };
    expect(snapshot.pickup.feeMajor).toBe(0);
    expect(snapshot.return.feeMajor).toBe(25);
    expect(laterRule.pickup.feeMajor).toBe(80);
    expect(snapshot.pickup.feeMajor).toBe(0);
  });

  test("partner confirmation uses the stored authoritative snapshot", () => {
    const order = {
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 100000,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
        prepaymentMinor: 10000,
      },
      locationSnapshot: snapshot,
    };
    expect(assertLocationSnapshotForConfirm(order).ok).toBe(true);
    expect(snapshotFeesMatchAuthoritativePrice(snapshot, order.authoritativePrice)).toBe(
      true
    );
    const mutated = {
      ...order,
      locationSnapshot: {
        ...snapshot,
        return: { ...snapshot.return, feeMajor: 99 },
      },
    };
    expect(assertLocationSnapshotForConfirm(mutated).ok).toBe(false);
    expect(assertLocationSnapshotForConfirm(mutated).code).toBe("PRICE_SNAPSHOT_INVALID");
  });

  test("Stripe checkout checksum includes location identity", () => {
    const order = {
      _id: "64b7f2c3a1b2c3d4e5f60789",
      car: "64b7f2c3a1b2c3d4e5f60711",
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 100000,
        prepaymentMinor: 10000,
        balanceMinor: 90000,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
      },
      locationSnapshot: snapshot,
    };
    const first = computePriceSnapshotChecksum(order);
    const afterTariffEdit = {
      ...order,
      locationSnapshot: {
        ...snapshot,
        return: { ...snapshot.return, feeMajor: 40, placeId: "ChIJ-other" },
      },
      authoritativePrice: {
        ...order.authoritativePrice,
        returnFeeMinor: 4000,
      },
    };
    expect(computePriceSnapshotChecksum(afterTariffEdit)).not.toBe(first);
    // Same money + same location ids → same checksum (live tariff alone does not reprice).
    const sameIdentity = {
      ...order,
      locationSnapshot: {
        ...snapshot,
        return: { ...snapshot.return, address: "Hotel Arts renovated lobby" },
      },
    };
    expect(computePriceSnapshotChecksum(sameIdentity)).toBe(first);
  });

  test("parseLocationSnapshot rejects free-text delivery without placeId", () => {
    const { parseLocationSnapshot } = require("../locationSnapshot");
    const bad = parseLocationSnapshot({
      pickup: {
        kind: "delivery",
        placeId: "",
        address: "Somewhere",
        feeMajor: 10,
      },
      return: {
        kind: "office",
        officeId: "64b7f2c3a1b2c3d4e5f60701",
        feeMajor: 0,
      },
      currency: "EUR",
    });
    expect(bad.ok).toBe(false);
  });

  test("parseAuthoritativePrice enforces prepay + balance = gross", () => {
    const { parseAuthoritativePrice } = require("../locationSnapshot");
    const bad = parseAuthoritativePrice({
      currency: "EUR",
      grossMinor: 10000,
      prepaymentMinor: 1000,
      balanceMinor: 8000,
      pickupFeeMinor: 0,
      returnFeeMinor: 0,
    });
    expect(bad.ok).toBe(false);
    const good = parseAuthoritativePrice({
      currency: "EUR",
      grossMinor: 10000,
      prepaymentMinor: 1000,
      balanceMinor: 9000,
      pickupFeeMinor: 0,
      returnFeeMinor: 2500,
    });
    expect(good.ok).toBe(true);
  });
});
