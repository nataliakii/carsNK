import { carMatchesSearchQuery, buildCarSearchText } from "../carSearch";

const sampleCar = {
  model: "Toyota Yaris",
  carNumber: "NKT123",
  class: "economy",
  transmission: "automatic",
  fueltype: "petrol",
  seats: 5,
  color: "white",
  engine: "1.5",
  airConditioning: true,
  registration: 2020,
};

describe("carMatchesSearchQuery", () => {
  it("matches model name", () => {
    expect(carMatchesSearchQuery(sampleCar, "yaris")).toBe(true);
    expect(carMatchesSearchQuery(sampleCar, "bmw")).toBe(false);
  });

  it("matches details and multi-token queries", () => {
    expect(carMatchesSearchQuery(sampleCar, "automatic petrol")).toBe(true);
    expect(carMatchesSearchQuery(sampleCar, "economy white")).toBe(true);
    expect(carMatchesSearchQuery(sampleCar, "diesel")).toBe(false);
  });

  it("empty query matches all", () => {
    expect(carMatchesSearchQuery(sampleCar, "")).toBe(true);
    expect(carMatchesSearchQuery(sampleCar, "   ")).toBe(true);
  });

  it("includes AC keywords when airConditioning is true", () => {
    expect(buildCarSearchText(sampleCar)).toContain("air conditioning");
    expect(carMatchesSearchQuery(sampleCar, "ac")).toBe(true);
  });
});
