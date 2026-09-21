import {
  enrichOfficeWithCompany,
  googleMapsEmbedUrl,
  resolveBookingDisplayOffices,
  resolveOfficeFormAddress,
} from "../carOffices";

const GREEK_COMPANY = {
  name: "Natali Cars",
  country: "GR",
  address: "Leoforos Nikisis, Kato Galini, Nea Kallikratia 63080, Greece",
  coords: { lat: "40.31", lon: "23.06" },
  locations: [{ name: "Nea Kallikratia", coords: { lat: "40.31", lon: "23.06" } }],
  deliveryPricing: { strategy: "cities", operatingCities: ["Barcelona"] },
};

describe("resolveBookingDisplayOffices Spain market", () => {
  test("does not show leftover Greek HQ on ES when car has no offices", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      GREEK_COMPANY,
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices).toHaveLength(1);
    expect(offices[0].name).toBe("Barcelona");
    expect(offices[0].address).not.toMatch(/Kallikratia|Greece|Leoforos/i);
    expect(offices[0].address).toBe("Natali Cars");
    expect(offices[0].addressUnset).toBe(true);
    expect(offices[0].lat).toBe("");
    expect(offices[0].lon).toBe("");
  });

  test("returns empty when ES has no Spain office and no matching operating city", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        ...GREEK_COMPANY,
        deliveryPricing: { strategy: "cities", operatingCities: [] },
      },
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices).toEqual([]);
  });

  test("prefers car offices and does not copy Greek street onto Barcelona", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [{ name: "Barcelona" }] },
      GREEK_COMPANY,
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices).toHaveLength(1);
    expect(offices[0].name).toBe("Barcelona");
    expect(offices[0].address).toBe("");
    expect(offices[0].lat).toBe("");
  });

  test("keeps a configured Spain street on a car office", () => {
    const offices = resolveBookingDisplayOffices(
      {
        offices: [
          { name: "Barcelona", address: "Carrer de Mallorca 1", lat: "41.39", lon: "2.16" },
        ],
      },
      GREEK_COMPANY,
      { countryCode: "ES" }
    );
    expect(offices[0].address).toContain("Mallorca");
    expect(offices[0].lat).toBe("41.39");
  });

  test("drops Greek-named car offices on ES", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: ["Nea Kallikratia"] },
      GREEK_COMPANY,
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices.map((o) => o.name)).toEqual(["Barcelona"]);
    expect(offices[0].address).not.toMatch(/Leoforos|Greece/i);
  });

  test("uses storefront city when company coords are in Barcelona", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        name: "Rovaro",
        country: "ES",
        address: "Leoforos Nikisis, Kato Galini, Nea Kallikratia 63080, Greece",
        coords: { lat: "41.3874", lon: "2.1686" },
        locations: [{ name: "Nea Kallikratia" }],
        deliveryPricing: { operatingCities: ["Barcelona"] },
      },
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices[0].name).toBe("Barcelona");
    expect(offices[0].address).not.toMatch(/Kallikratia|Leoforos|Greece/i);
    expect(offices[0].lat).toBe("41.3874");
    expect(offices[0].lon).toBe("2.1686");
  });

  test("keeps a real Spain company base", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        name: "Rovaro",
        country: "ES",
        address: "Carrer Example 1, Barcelona",
        coords: { lat: "41.4", lon: "2.17" },
        locations: [{ name: "Barcelona" }],
      },
      { countryCode: "ES", selectedCity: "Barcelona" }
    );
    expect(offices[0].name).toBe("Barcelona");
    expect(offices[0].address).toContain("Carrer Example");
    expect(offices[0].addressUnset).toBe(false);
  });
});

describe("resolveBookingDisplayOffices Greece", () => {
  test("still shows Nea Kallikratia for a Greece car/company", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: [] },
      {
        name: "Natali Cars",
        country: "GR",
        address: "Leoforos Nikisis, Kato Galini, Nea Kallikratia 63080, Greece",
        coords: { lat: "40.31", lon: "23.06" },
        locations: [{ name: "Nea Kallikratia" }],
      },
      { countryCode: "GR" }
    );
    expect(offices).toHaveLength(1);
    expect(offices[0].name).toBe("Nea Kallikratia");
    expect(offices[0].address).toContain("Leoforos");
  });

  test("keeps explicit Greek car offices", () => {
    const offices = resolveBookingDisplayOffices(
      { offices: ["Nea Kallikratia"] },
      {
        name: "Natali Cars",
        country: "GR",
        address: "Antonioy Kelesi 12, Nea Kallikratia 630 80",
        coords: { lat: "40.31", lon: "23.06" },
      },
      { countryCode: "GR" }
    );
    expect(offices[0].name).toBe("Nea Kallikratia");
    expect(offices[0].address).toContain("Antonioy");
  });
});

describe("enrichOfficeWithCompany", () => {
  test("does not copy Greek HQ onto a Barcelona office", () => {
    const enriched = enrichOfficeWithCompany(
      { name: "Barcelona", address: "", lat: "", lon: "" },
      GREEK_COMPANY
    );
    expect(enriched.address).toBe("");
    expect(enriched.lat).toBe("");
  });

  test("still copies Greek company street onto a Greek office", () => {
    const enriched = enrichOfficeWithCompany(
      { name: "Nea Kallikratia", address: "", lat: "", lon: "" },
      GREEK_COMPANY
    );
    expect(enriched.address).toContain("Leoforos");
  });
});

describe("resolveOfficeFormAddress", () => {
  test("does not prefill Greek street for a Barcelona office", () => {
    expect(
      resolveOfficeFormAddress({ name: "Barcelona", address: "" }, GREEK_COMPANY)
    ).toBe("");
  });
});

describe("googleMapsEmbedUrl", () => {
  test("builds a key-free embed from coordinates", () => {
    expect(
      googleMapsEmbedUrl({ lat: "41.39", lon: "2.16", address: "" })
    ).toContain("maps.google.com/maps?q=41.39%2C2.16");
  });
});
