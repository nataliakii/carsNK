import mongoose from "mongoose";
import {
  archiveOfficeRecord,
  assertOfficeBelongsToCompany,
  findEligibleOffice,
  persistOfficeShape,
  publicOfficeView,
  resolveEligibleOffices,
  syncCarOfficeIds,
} from "../officeRecord";

const companyId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const officeA = persistOfficeShape(
  {
    name: "Barcelona office",
    address: "Carrer de Mallorca 1, Barcelona",
    city: "Barcelona",
    country: "ES",
    locationType: "office",
    status: "active",
  },
  { assignId: true }
);
const officeB = persistOfficeShape(
  {
    name: "Airport desk",
    address: "BCN T1",
    city: "El Prat",
    country: "ES",
    locationType: "airport",
    status: "archived",
  },
  { assignId: true }
);
const foreign = persistOfficeShape(
  {
    name: "Valencia other co",
    address: "Carrer X",
    country: "ES",
    status: "active",
  },
  { assignId: true }
);

const company = { _id: companyId, offices: [officeA, officeB], tel: "+34900000000" };

describe("company offices", () => {
  test("persist assigns a stable id and keeps address fields", () => {
    expect(officeA._id).toBeTruthy();
    expect(officeA.address).toContain("Mallorca");
    expect(officeA.status).toBe("active");
  });

  test("inactive offices are excluded from customer results", () => {
    const eligible = resolveEligibleOffices({
      car: { ownerId: companyId, officeScope: "all" },
      company,
    });
    expect(eligible.map((o) => o.name)).toEqual(["Barcelona office"]);
    expect(publicOfficeView(officeB)).toBeNull();
  });

  test("car exposes only eligible offices belonging to its owner", () => {
    const leaked = resolveEligibleOffices({
      car: { ownerId: otherId, officeIds: [officeA._id], officeScope: "selected" },
      company,
    });
    expect(leaked).toEqual([]);

    const selected = resolveEligibleOffices({
      car: { ownerId: companyId, officeIds: [officeA._id], officeScope: "selected" },
      company,
    });
    expect(selected).toHaveLength(1);
    expect(String(selected[0]._id)).toBe(String(officeA._id));
    expect(findEligibleOffice(selected, foreign._id)).toBeNull();
    expect(assertOfficeBelongsToCompany({ companyId: String(otherId) }, companyId)).toBe(
      false
    );
  });

  test("legacy car names match only this company's offices", () => {
    const matched = resolveEligibleOffices({
      car: { ownerId: companyId, offices: ["Barcelona office"] },
      company,
    });
    expect(matched[0].name).toBe("Barcelona office");
  });

  test("archive keeps the record instead of deleting it", () => {
    const archived = archiveOfficeRecord(officeA);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.name).toBe("Barcelona office");
  });

  test("syncCarOfficeIds maps legacy names to company office ids", () => {
    const synced = syncCarOfficeIds({
      offices: [{ name: "Barcelona office" }],
      company,
    });
    expect(synced.officeIds).toEqual([String(officeA._id)]);
    expect(synced.officeScope).toBe("selected");
  });
});
