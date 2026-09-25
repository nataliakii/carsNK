import {
  DEFAULT_SORT,
  SORT_OPTION,
  normalizeSort,
  quotedTotalOf,
  sortCarsByQuotedTotal,
} from "../carResultSorting";

const CARS = [
  { _id: "c1", make: "Peugeot", model: "208" },
  { _id: "c2", make: "Fiat", model: "500" },
  { _id: "c3", make: "Audi", model: "A3" },
];

const QUOTES = {
  c1: { totalPrice: 210 },
  c2: { totalPrice: 105 },
  c3: { totalPrice: 480 },
};

function ids(list) {
  return list.map((car) => car._id);
}

describe("SEARCH_FIRST result sorting", () => {
  test("default sorting is total price ascending", () => {
    expect(DEFAULT_SORT).toBe(SORT_OPTION.PRICE_ASC);
    expect(ids(sortCarsByQuotedTotal(CARS, QUOTES, DEFAULT_SORT))).toEqual([
      "c2",
      "c1",
      "c3",
    ]);
  });

  test("descending sorting works", () => {
    expect(ids(sortCarsByQuotedTotal(CARS, QUOTES, SORT_OPTION.PRICE_DESC))).toEqual(
      ["c3", "c1", "c2"]
    );
  });

  test("sorting uses the quoted total, not the base daily rate", () => {
    const cars = [
      { _id: "cheapDaily", make: "A", model: "A", pricingTiers: [{ price: 10 }] },
      { _id: "dearDaily", make: "B", model: "B", pricingTiers: [{ price: 90 }] },
    ];
    // The cheap daily rate quotes higher for this range (long-rental discount).
    const quotes = { cheapDaily: { totalPrice: 300 }, dearDaily: { totalPrice: 120 } };
    expect(ids(sortCarsByQuotedTotal(cars, quotes, SORT_OPTION.PRICE_ASC))).toEqual([
      "dearDaily",
      "cheapDaily",
    ]);
  });

  test("sorting never compares formatted price text", () => {
    // "€1000" sorts before "€90" as text; as numbers it must not.
    const cars = [
      { _id: "big", make: "A", model: "A" },
      { _id: "small", make: "B", model: "B" },
    ];
    const quotes = {
      big: { totalPrice: 1000, priceText: "€1000" },
      small: { totalPrice: 90, priceText: "€90" },
    };
    expect(ids(sortCarsByQuotedTotal(cars, quotes, SORT_OPTION.PRICE_ASC))).toEqual([
      "small",
      "big",
    ]);
  });

  test("equal totals fall back to a stable name order", () => {
    const quotes = {
      c1: { totalPrice: 200 },
      c2: { totalPrice: 200 },
      c3: { totalPrice: 200 },
    };
    const once = ids(sortCarsByQuotedTotal(CARS, quotes, SORT_OPTION.PRICE_ASC));
    const twice = ids(
      sortCarsByQuotedTotal([...CARS].reverse(), quotes, SORT_OPTION.PRICE_ASC)
    );
    expect(once).toEqual(["c3", "c2", "c1"]);
    expect(twice).toEqual(once);
  });

  test("cars without a quote sink to the bottom in both directions", () => {
    const partial = { c1: { totalPrice: 210 } };
    expect(ids(sortCarsByQuotedTotal(CARS, partial, SORT_OPTION.PRICE_ASC))[0]).toBe(
      "c1"
    );
    expect(ids(sortCarsByQuotedTotal(CARS, partial, SORT_OPTION.PRICE_DESC))[0]).toBe(
      "c1"
    );
  });

  test("sorting does not mutate the input list", () => {
    const input = [...CARS];
    sortCarsByQuotedTotal(input, QUOTES, SORT_OPTION.PRICE_DESC);
    expect(ids(input)).toEqual(["c1", "c2", "c3"]);
  });

  test("an unknown sort value falls back to ascending", () => {
    expect(normalizeSort("SIDEWAYS")).toBe(SORT_OPTION.PRICE_ASC);
    expect(quotedTotalOf({ totalPrice: "nope" })).toBeNull();
    expect(quotedTotalOf({ totalPrice: 0 })).toBe(0);
  });
});
