import { buildCarSpecGroups, buildCarSpecList } from "../carSpecs";

const t = (key, params) => {
  if (key === "order.perDay") return "day";
  if (key === "car.yes") return "Yes";
  if (key === "car.no") return "No";
  return key;
};

const baseCar = {
  model: "Toyota Yaris",
  class: "economy",
  transmission: "automatic",
  fueltype: "petrol",
  seats: 5,
  numberOfDoors: 5,
  airConditioning: true,
  registration: 2019,
  engine: "1.500",
  enginePower: 110,
  color: "white",
  regNumber: "NKT 123",
  PriceKacko: 5,
  franchise: 300,
  PriceChildSeats: 3,
};

const findItem = (car, key) =>
  buildCarSpecList(car, t).find((item) => item.key === key);

describe("buildCarSpecGroups", () => {
  it("groups specs into highlights, vehicle and insurance", () => {
    expect(buildCarSpecGroups(baseCar, t).map((g) => g.id)).toEqual([
      "highlights",
      "vehicle",
      "insurance",
    ]);
  });

  it("limits highlights to the four facts shown before expanding", () => {
    const highlights = buildCarSpecGroups(baseCar, t).find(
      (g) => g.id === "highlights"
    );
    expect(highlights.items.map((i) => i.key)).toEqual([
      "class",
      "transmission",
      "fueltype",
      "seats",
    ]);
  });

  it("puts doors and air conditioning in the vehicle group", () => {
    const vehicle = buildCarSpecGroups(baseCar, t).find(
      (g) => g.id === "vehicle"
    );
    expect(vehicle.items.map((i) => i.key)).toContain("numberOfDoors");
    expect(vehicle.items.map((i) => i.key)).toContain("airConditioning");
  });

  it("capitalizes enum-style values and formats units", () => {
    expect(findItem(baseCar, "transmission").value).toBe("Automatic");
    expect(findItem(baseCar, "engine").value).toBe("1.500 c.c.");
    expect(findItem(baseCar, "enginePower").value).toBe("110 bhp");
    expect(findItem(baseCar, "PriceKacko").value).toBe("5 € / day");
    expect(findItem(baseCar, "franchiseKacko").value).toBe("300 €");
  });

  it("renders air conditioning as a translated yes/no", () => {
    expect(findItem(baseCar, "airConditioning").value).toBe("Yes");
    expect(findItem({ ...baseCar, airConditioning: false }, "airConditioning").value).toBe(
      "No"
    );
  });

  it("keeps zero-valued prices instead of dropping them", () => {
    expect(findItem({ ...baseCar, franchise: 0 }, "franchiseKacko").value).toBe(
      "0 €"
    );
  });

  it("drops rows with no data and keeps the label-only TPL row", () => {
    const sparse = { ...baseCar, color: undefined, regNumber: "" };
    const keys = buildCarSpecList(sparse, t).map((item) => item.key);
    expect(keys).not.toContain("color");
    expect(keys).not.toContain("regNumber");
    expect(keys).toContain("insuranceTPLFree");
  });

  it("never exposes a deposit row", () => {
    const keys = buildCarSpecList({ ...baseCar, deposit: 500 }, t).map(
      (item) => item.key
    );
    expect(keys).not.toContain("deposit");
  });
});
