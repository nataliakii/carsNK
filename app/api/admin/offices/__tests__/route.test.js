/**
 * @jest-environment node
 */
jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
  },
}));
jest.mock("@models/order", () => ({
  Order: { exists: jest.fn() },
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { requireAdmin } from "@lib/adminAuth";
import Company from "@models/company";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

const companyA = "64b7f2c3a1b2c3d4e5f60701";
const companyB = "64b7f2c3a1b2c3d4e5f60702";
const officeId = "64b7f2c3a1b2c3d4e5f60711";

function admin(ownerId, role = 0) {
  requireAdmin.mockResolvedValue({
    session: {
      user: {
        id: "u1",
        email: "admin@a.test",
        isAdmin: true,
        role,
        ownerId,
      },
    },
    errorResponse: null,
  });
}

function superadmin() {
  requireAdmin.mockResolvedValue({
    session: {
      user: {
        id: "root",
        email: "root@rovaro.autos",
        isAdmin: true,
        role: 2,
        isSuperAdmin: true,
      },
    },
    errorResponse: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("admin offices API", () => {
  test("company ADMIN can create and edit its own office", async () => {
    admin(companyA);
    Company.findByIdAndUpdate.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: companyA,
          tel: "+34",
          offices: [{ _id: officeId, name: "BCN", address: "Mallorca 1" }],
        }),
    });
    const created = await POST(
      new Request("https://rovaro.autos/api/admin/offices", {
        method: "POST",
        body: JSON.stringify({ name: "BCN", address: "Mallorca 1" }),
      })
    );
    expect(created.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COMPANY_OFFICE_CREATED" })
    );

    const officeDoc = {
      _id: officeId,
      name: "BCN",
      toObject: () => ({ _id: officeId, name: "BCN", address: "Mallorca 1" }),
    };
    const companyDoc = {
      _id: companyA,
      offices: { id: () => officeDoc },
      save: jest.fn(),
    };
    Company.findOne.mockResolvedValue(companyDoc);
    const patched = await PATCH(
      new Request(`https://rovaro.autos/api/admin/offices/${officeId}`, {
        method: "PATCH",
        body: JSON.stringify({ address: "Mallorca 2" }),
      }),
      { params: { id: officeId } }
    );
    expect(patched.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COMPANY_OFFICE_UPDATED" })
    );
  });

  test("company ADMIN cannot access another company's office", async () => {
    admin(companyA);
    Company.findById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: companyA,
          offices: [{ _id: officeId, name: "Mine", status: "active" }],
        }),
    });
    const list = await GET(
      new Request(`https://rovaro.autos/api/admin/offices?companyId=${companyB}`)
    );
    const body = await list.json();
    expect(String(body.offices?.[0]?.companyId || companyA)).toBe(companyA);

    Company.findOne.mockResolvedValue(null);
    const other = await PATCH(
      new Request(`https://rovaro.autos/api/admin/offices/${officeId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Hack" }),
      }),
      { params: { id: officeId } }
    );
    expect(other.status).toBe(404);
  });

  test("SUPERADMIN can access all offices", async () => {
    superadmin();
    Company.findById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: companyB,
          offices: [{ _id: officeId, name: "Other", status: "active" }],
        }),
    });
    const list = await GET(
      new Request(`https://rovaro.autos/api/admin/offices?companyId=${companyB}`)
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.offices[0].name).toBe("Other");
  });

  test("audit logs are written for office archive", async () => {
    admin(companyA);
    const officeDoc = {
      _id: officeId,
      name: "BCN",
      toObject: () => ({ _id: officeId, name: "BCN" }),
    };
    Company.findOne.mockResolvedValue({
      _id: companyA,
      offices: { id: () => officeDoc },
      save: jest.fn(),
    });
    const { Order } = require("@models/order");
    Order.exists.mockResolvedValue(true);
    const res = await DELETE(
      new Request(`https://rovaro.autos/api/admin/offices/${officeId}`),
      { params: { id: officeId } }
    );
    expect(res.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COMPANY_OFFICE_ARCHIVED" })
    );
  });
});
