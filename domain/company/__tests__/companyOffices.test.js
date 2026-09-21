import {
  emptyCompanyOffice,
  normalizeCompanyOffices,
  officeOrigins,
  primaryOfficePoint,
  resolveCompanyOffices,
} from "../companyOffices";
import { resolveBookingDisplayOffices } from "@/domain/orders/carOffices";

const GREEK_ON_ES = {
  name: "Rovaro",
  country: "ES",
  address: "Leoforos Nikisis, Kato Galini, Nea Kallikratia 63080, Greece",
  coords: { lat: "41.3874", lon: "2.1686" },
  locations: [{ name: "Nea Kallikratia" }],
  deliveryPricing: { operatingCities: ["Barcelona"] },
};

describe("normalizeCompanyOffices", () => {
  test("accepts lng alias and keeps empty address", () => {
    const offices = normalizeCompanyOffices([
      { name: "Barcelona", address: "", lat: "41.39", lng: "2.16" },
    ]);
    expect(offices).toEqual([
      { name: "Barcelona", address: "", lat: "41.39", lon: "2.16" },
    ]);
  });

  test("does not invent a street when nothing is typed", () => {
    expect(emptyCompanyOffice().address).toBe("");
  });
});

describe("resolveCompanyOffices", () => {
  test("stored offices win and keep an empty street", () => {
    const offices = resolveCompanyOffices({
      ...GREEK_ON_ES,
      offices: [{ name: "Rovaro office", address: "", lat: "41.4", lon: "2.17" }],
    });
    expect(offices).toHaveLength(1);
    expect(offices[0].name).toBe("Rovaro office");
    expect(offices[0].address).toBe("");
  });

  test("legacy ES company with only coords does not copy a Greek street", () => {
    const offices = resolveCompanyOffices(GREEK_ON_ES);
    expect(offices).toHaveLength(1);
    expect(offices[0].address).toBe("");
    expect(offices[0].lat).toBe("41.3874");
    expect(offices[0].lon).toBe("2.1686");
    expect(offices[0].name).not.toMatch(/Kallikratia/i);
  });

  test("does not copy a country-only company.address into the office street", () => {
    const offices = resolveCompanyOffices({
      name: "Test",
      country: "ES",
      address: "Spain",
      coords: { lat: "41.3874", lon: "2.1686" },
    });
    expect(offices[0].address).toBe("");
  });

  test("primary office is the first with coordinates", () => {
    const point = primaryOfficePoint([
      { name: "Desk", address: "Carrer 1" },
      { name: "Warehouse", address: "", lat: "41.4", lon: "2.17" },
    ]);
    expect(point).toMatchObject({ lat: 41.4, lon: 2.17, name: "Warehouse" });
  });

  test("officeOrigins falls back to company coords", () => {
    expect(
      officeOrigins([], { lat: "41.3874", lon: "2.1686" })
    ).toEqual([{ lat: 41.3874, lon: 2.1686 }]);
  });
});

describe("public booking uses company.offices", () => {
  test("Spain booking shows the stored office street, not leftover GR contacts", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        ...GREEK_ON_ES,
        offices: [
          {
            name: "Rovaro",
            address: "Carrer de Mallorca 1, Barcelona",
            lat: "41.39",
            lon: "2.16",
          },
        ],
      },
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices).toHaveLength(1);
    expect(offices[0].address).toContain("Mallorca");
    expect(offices[0].address).not.toMatch(/Kallikratia|Leoforos/i);
    expect(offices[0].addressUnset).toBe(false);
  });

  test("empty stored office address stays unset instead of inventing a street", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        ...GREEK_ON_ES,
        offices: [{ name: "Rovaro", address: "", lat: "41.3874", lon: "2.1686" }],
      },
      { countryCode: "ES" }
    );
    expect(offices[0].address).toBe("");
    expect(offices[0].addressUnset).toBe(true);
  });
});
