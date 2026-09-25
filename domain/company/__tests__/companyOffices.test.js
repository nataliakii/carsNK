import {
  addOfficeToList,
  createDefaultOffice,
  emptyCompanyOffice,
  getOfficeKey,
  mergeOfficesPreservingIds,
  normalizeCompanyOffices,
  officeOrigins,
  primaryOfficePoint,
  removeOfficeByKey,
  resolveCompanyOffices,
  resolveCompanyDefaultPlaceName,
  updateOfficeByKey,
  companyOfficesPatchValue,
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
    expect(offices).toMatchObject([
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

describe("resolveCompanyDefaultPlaceName", () => {
  test("prefers office.city over office name", () => {
    expect(
      resolveCompanyDefaultPlaceName({
        name: "Rovaro Cars",
        country: "ES",
        offices: [
          { name: "Main desk", city: "Barcelona", address: "Carrer X 1" },
        ],
      })
    ).toBe("Barcelona");
  });

  test("uses locations[0] when offices have no city/name", () => {
    expect(
      resolveCompanyDefaultPlaceName({
        name: "Test Co",
        locations: [{ name: "Hospitalet de Llobregat" }],
        offices: [],
      })
    ).toBe("Hospitalet de Llobregat");
  });

  test("does not invent Nea Kallikratia for an empty company", () => {
    expect(resolveCompanyDefaultPlaceName({})).toBe("");
    expect(resolveCompanyDefaultPlaceName(null)).toBe("");
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

describe("mergeOfficesPreservingIds", () => {
  test("keeps existing _id when superadmin patches the same office", () => {
    const id = "64b7f2c3a1b2c3d4e5f60711";
    const merged = mergeOfficesPreservingIds(
      [{ _id: id, name: "BCN", address: "Old" }],
      [{ _id: id, name: "BCN", address: "New Mallorca 1" }]
    );
    expect(String(merged[0]._id)).toBe(id);
    expect(merged[0].address).toContain("Mallorca");
  });
});

describe("independent office form state", () => {
  test("createDefaultOffice never reuses the same object or nested refs", () => {
    const a = createDefaultOffice();
    const b = createDefaultOffice();
    expect(a).not.toBe(b);
    expect(a.openingHours).not.toBe(b.openingHours);
    expect(getOfficeKey(a)).toBeTruthy();
    expect(getOfficeKey(a)).not.toBe(getOfficeKey(b));
    expect(emptyCompanyOffice()).not.toBe(emptyCompanyOffice());
  });

  test("activating office A does not change office B", () => {
    let offices = addOfficeToList([]);
    offices = addOfficeToList(offices);
    const keyA = getOfficeKey(offices[0]);
    const keyB = getOfficeKey(offices[1]);
    offices = updateOfficeByKey(offices, keyA, {
      active: true,
      status: "active",
      name: "Office A",
    });
    offices = updateOfficeByKey(offices, keyB, {
      active: false,
      status: "archived",
      name: "Office B",
    });
    expect(offices[0].name).toBe("Office A");
    expect(offices[0].status).toBe("active");
    expect(offices[1].name).toBe("Office B");
    expect(offices[1].status).toBe("archived");
    expect(offices[1].active).toBe(false);
  });

  test("changing office B address leaves office A unchanged", () => {
    const savedA = {
      _id: "64b7f2c3a1b2c3d4e5f60711",
      name: "Office A",
      address: "Carrer A",
      locationType: "office",
    };
    const unsavedB = createDefaultOffice();
    unsavedB.name = "Office B";
    unsavedB.address = "Carrer B";
    let offices = [savedA, unsavedB];
    offices = updateOfficeByKey(offices, getOfficeKey(unsavedB), {
      address: "Passeig de Gràcia 1",
    });
    expect(offices[0].address).toBe("Carrer A");
    expect(offices[0].name).toBe("Office A");
    expect(offices[1].address).toBe("Passeig de Gràcia 1");
    expect(offices[1].name).toBe("Office B");
  });

  test("changing office A location type leaves office B unchanged", () => {
    let offices = addOfficeToList(addOfficeToList([]));
    const keyA = getOfficeKey(offices[0]);
    const keyB = getOfficeKey(offices[1]);
    offices = updateOfficeByKey(offices, keyA, { locationType: "airport" });
    expect(offices.find((o) => getOfficeKey(o) === keyA).locationType).toBe(
      "airport"
    );
    expect(offices.find((o) => getOfficeKey(o) === keyB).locationType).toBe(
      "office"
    );
  });

  test("removing office A leaves office B", () => {
    let offices = addOfficeToList(addOfficeToList([]));
    offices = updateOfficeByKey(offices, getOfficeKey(offices[0]), {
      name: "Office A",
    });
    offices = updateOfficeByKey(offices, getOfficeKey(offices[1]), {
      name: "Office B",
    });
    const keyA = getOfficeKey(offices[0]);
    const keyB = getOfficeKey(offices[1]);
    offices = removeOfficeByKey(offices, keyA);
    expect(offices).toHaveLength(1);
    expect(getOfficeKey(offices[0])).toBe(keyB);
    expect(offices[0].name).toBe("Office B");
  });

  test("save payload keeps offices independent after reload-shaped merge", () => {
    const a = {
      _id: "64b7f2c3a1b2c3d4e5f60711",
      name: "Office A",
      address: "Carrer A",
      locationType: "airport",
      status: "active",
    };
    const b = createDefaultOffice();
    b.name = "Office B";
    b.address = "Carrer B";
    b.locationType = "hotel";
    const merged = mergeOfficesPreservingIds([a], [a, b]);
    expect(merged).toHaveLength(2);
    expect(String(merged[0]._id)).toBe(a._id);
    expect(merged[0].locationType).toBe("airport");
    expect(merged[0].address).toBe("Carrer A");
    expect(merged[1].address).toBe("Carrer B");
    expect(merged[1].locationType).toBe("hotel");
    expect(String(merged[1]._id)).not.toBe(String(merged[0]._id));
  });

  test("nested openingHours clones so offices do not share refs", () => {
    let offices = addOfficeToList(addOfficeToList([]));
    const keyA = getOfficeKey(offices[0]);
    offices = updateOfficeByKey(offices, keyA, {
      openingHours: { start: "09:00" },
    });
    expect(offices[0].openingHours.start).toBe("09:00");
    expect(offices[1].openingHours.start).toBe("");
    expect(offices[0].openingHours).not.toBe(offices[1].openingHours);
  });

  test("saved _id and unsaved clientId offices stay independent through reload mapping", () => {
    const saved = {
      _id: "64b7f2c3a1b2c3d4e5f60711",
      name: "Office A",
      address: "Carrer A",
      locationType: "airport",
      status: "active",
    };
    const draft = createDefaultOffice();
    const clientId = draft.clientId;
    const offices = resolveCompanyOffices({
      offices: [
        saved,
        {
          ...draft,
          name: "Office B",
          address: "Carrer B",
          locationType: "hotel",
        },
      ],
    });
    expect(offices).toHaveLength(2);
    expect(String(offices[0]._id)).toBe(saved._id);
    expect(offices[0].address).toBe("Carrer A");
    expect(offices[0].locationType).toBe("airport");
    expect(offices[1].clientId).toBe(clientId);
    expect(offices[1].address).toBe("Carrer B");
    expect(offices[1].locationType).toBe("hotel");
  });

  test("save payload keeps each office's values and does not copy A onto B", () => {
    const payload = companyOfficesPatchValue([
      {
        _id: "64b7f2c3a1b2c3d4e5f60711",
        name: "Office A",
        address: "Carrer A",
        locationType: "airport",
        status: "active",
      },
      {
        name: "Office B",
        address: "Carrer B",
        locationType: "hotel",
        status: "archived",
        clientId: "draft-b",
      },
    ]);
    expect(payload).toHaveLength(2);
    expect(payload[0].address).toBe("Carrer A");
    expect(payload[0].locationType).toBe("airport");
    expect(payload[0].status).toBe("active");
    expect(payload[1].address).toBe("Carrer B");
    expect(payload[1].locationType).toBe("hotel");
    expect(payload[1].status).toBe("archived");
    expect(String(payload[0]._id)).not.toBe(String(payload[1]._id));
  });
});
