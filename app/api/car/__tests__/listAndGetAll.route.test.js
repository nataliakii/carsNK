/**
 * @jest-environment node
 */
jest.mock("@lib/adminAuth", () => ({
  getServerSessionWithViewAs: jest.fn(),
}));
jest.mock("@/domain/services", () => ({
  getCars: jest.fn(),
  getCarById: jest.fn(),
}));
jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));
jest.mock("@lib/authOptions", () => ({ authOptions: {} }));

import { getServerSessionWithViewAs } from "@lib/adminAuth";
import { getCars, getCarById } from "@/domain/services";
import { getServerSession } from "next-auth/next";
import { GET as getAllGet, POST as getAllPost } from "../getAll/route";
import { GET as allGet, POST as allPost } from "../all/route";
import { GET as getById } from "../[...id]/route";

const companyA = "64b7f2c3a1b2c3d4e5f60701";
const companyB = "64b7f2c3a1b2c3d4e5f60702";
const carA = {
  _id: "64b7f2c3a1b2c3d4e5f607a1",
  model: "Yaris",
  ownerId: companyA,
  officeIds: ["64b7f2c3a1b2c3d4e5f60711"],
  officeScope: "selected",
};
const carLegacy = {
  _id: "64b7f2c3a1b2c3d4e5f607a2",
  model: "Legacy",
  ownerId: companyA,
  // no officeIds
};
const carMissingOffice = {
  _id: "64b7f2c3a1b2c3d4e5f607a3",
  model: "GhostOffice",
  ownerId: companyA,
  officeIds: ["64b7f2c3a1b2c3d4e5f60999"],
  officeScope: "selected",
};

function sessionAdmin(ownerId) {
  getServerSessionWithViewAs.mockResolvedValue({
    user: {
      id: "u1",
      email: "admin@a.test",
      isAdmin: true,
      role: 1,
      ownerId,
    },
  });
}

function sessionSuper() {
  getServerSessionWithViewAs.mockResolvedValue({
    user: {
      id: "root",
      email: "root@rovaro.autos",
      isAdmin: true,
      role: 2,
      isSuperAdmin: true,
    },
  });
}

function sessionPublic() {
  getServerSessionWithViewAs.mockResolvedValue(null);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("/api/car/getAll and /api/car/all", () => {
  test("ADMIN list returns own-company cars via getAll and all", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([carA, carLegacy]);

    for (const handler of [getAllGet, allGet]) {
      const res = await handler(new Request("https://x/api/car/getAll"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0].ownerId).toBe(companyA);
      expect(getCars).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            user: expect.objectContaining({ ownerId: companyA }),
          }),
          marketplaceOnly: false,
        })
      );
    }
  });

  test("getCars is called once per request (no N+1)", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([carA, carLegacy, carMissingOffice]);
    const res = await getAllGet(new Request("https://x/api/car/getAll"));
    expect(res.status).toBe(200);
    expect(getCars).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  test("ADMIN session is passed so service can scope out other companies", async () => {
    sessionAdmin(companyA);
    // Service layer is responsible for filter; route must pass session through.
    getCars.mockImplementation(async ({ session }) => {
      expect(session.user.ownerId).toBe(companyA);
      return [carA];
    });
    const res = await allGet(new Request("https://x/api/car/all"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([carA]);
  });

  test("SUPERADMIN gets marketplaceOnly=false and full session", async () => {
    sessionSuper();
    getCars.mockResolvedValue([carA, { ...carA, _id: "x", ownerId: companyB }]);
    const res = await getAllGet(new Request("https://x/api/car/getAll"));
    expect(res.status).toBe(200);
    expect(getCars).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplaceOnly: false,
        session: expect.objectContaining({
          user: expect.objectContaining({ role: 2 }),
        }),
      })
    );
    expect((await res.json()).length).toBe(2);
  });

  test("empty fleet returns 200 + []", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([]);
    const res = await getAllGet(new Request("https://x/api/car/getAll"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("legacy car without officeIds and missing office refs do not crash", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([carLegacy, carMissingOffice]);
    const res = await allGet(new Request("https://x/api/car/all"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].officeIds).toBeUndefined();
    expect(body[1].officeIds).toEqual(["64b7f2c3a1b2c3d4e5f60999"]);
  });

  test("database failure returns safe 500 without stack", async () => {
    sessionAdmin(companyA);
    getCars.mockRejectedValue(new Error("ECONNREFUSED secret-mongo-uri"));
    const res = await getAllGet(new Request("https://x/api/car/getAll"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Failed to fetch cars" });
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|secret-mongo|stack/i);
  });

  test("POST refresh uses getCars without marketplaceOnly filter flag", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([carA]);
    const res = await getAllPost(
      new Request("https://x/api/car/getAll", { method: "POST" })
    );
    expect(res.status).toBe(200);
    expect(getCars).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.any(Object),
      })
    );
    // POST path does not pass marketplaceOnly
    expect(getCars.mock.calls[0][0].marketplaceOnly).toBeUndefined();
  });

  test("public GET uses marketplaceOnly", async () => {
    sessionPublic();
    getCars.mockResolvedValue([carA]);
    await allGet(new Request("https://x/api/car/all"));
    expect(getCars).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceOnly: true })
    );
  });

  test("concurrent getAll requests each succeed independently", async () => {
    sessionAdmin(companyA);
    getCars.mockResolvedValue([carA]);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        getAllGet(new Request("https://x/api/car/getAll"))
      )
    );
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([carA]);
    }
    expect(getCars).toHaveBeenCalledTimes(8);
  });

  test("all and getAll POST share behaviour", async () => {
    sessionSuper();
    getCars.mockResolvedValue([]);
    const a = await allPost(new Request("https://x/api/car/all", { method: "POST" }));
    const b = await getAllPost(
      new Request("https://x/api/car/getAll", { method: "POST" })
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await a.json()).toEqual([]);
    expect(await b.json()).toEqual([]);
  });
});

describe("/api/car/[id] catch-all", () => {
  test("non-ObjectId path like getAll is rejected with 400 (not 500 CastError)", async () => {
    // Dedicated /api/car/getAll exists; if catch-all still receives the
    // alias it must list cars (200) rather than CastError 500.
    getCars.mockResolvedValue([carA]);
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: 2, isSuperAdmin: true },
    });
    const res = await getById(new Request("https://x/api/car/getAll"), {
      params: { id: ["getAll"] },
    });
    expect(res.status).toBe(200);
    expect(getCarById).not.toHaveBeenCalled();
    expect(await res.json()).toEqual([carA]);
  });

  test("truly invalid ObjectId-like segment returns 400", async () => {
    const res = await getById(new Request("https://x/api/car/not-an-id"), {
      params: { id: ["not-an-id"] },
    });
    expect(res.status).toBe(400);
    expect(getCarById).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.message).toMatch(/invalid car id/i);
  });

  test("valid id returns car", async () => {
    getServerSession.mockResolvedValue({ user: { isAdmin: true, role: 2 } });
    getCarById.mockResolvedValue(carA);
    const res = await getById(new Request("https://x/api/car/" + carA._id), {
      params: { id: [carA._id] },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ model: "Yaris" });
  });

  test("service failure returns safe 500", async () => {
    getServerSession.mockResolvedValue(null);
    getCarById.mockRejectedValue(new Error("boom"));
    const res = await getById(new Request("https://x/api/car/" + carA._id), {
      params: { id: [carA._id] },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Failed to fetch car" });
  });
});
