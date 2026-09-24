/**
 * @jest-environment node
 *
 * Company isolation and Stripe/payment gating for transfer-services.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("@models/car", () => ({
  Car: { find: jest.fn() },
}));

import { requireAdmin } from "@/lib/adminAuth";
import Company from "@models/company";
import { Car } from "@models/car";
import { ROLE } from "@models/user";
import { GET, PATCH } from "../route";

const OWN = "64b7f2c3a1b2c3d4e5f60711";
const OTHER = "64b7f2c3a1b2c3d4e5f60722";

const existingTs = {
  enabled: true,
  maxPassengers: 4,
  vehicleCategories: ["STANDARD"],
  serviceCities: ["malaga"],
  airportsServed: ["AGP"],
  payments: { stripeForPlatformFee: true, stripeForCompanyAmount: false },
};

function lean(value) {
  return {
    select: () => ({
      lean: async () => value,
    }),
  };
}

function signedInAs(user) {
  requireAdmin.mockResolvedValue({ session: { user }, errorResponse: null });
}

const companyAdmin = {
  isAdmin: true,
  role: ROLE.ADMIN,
  email: "admin@partner.test",
  ownerId: OWN,
};

const platformAdmin = {
  isAdmin: true,
  role: ROLE.SUPERADMIN,
  email: "root@rovaro.test",
};

function request({ url = "http://localhost/api/admin/transfer-services", body } = {}) {
  return {
    url,
    cookies: { get: () => undefined },
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Company.findById.mockImplementation((id) =>
    lean(
      String(id) === OWN
        ? {
            _id: OWN,
            name: "Own Co",
            email: "desk@own.test",
            country: "ES",
            transferServices: existingTs,
            deliveryPricing: { operatingCities: ["Malaga"] },
            offices: [],
          }
        : String(id) === OTHER
          ? {
              _id: OTHER,
              name: "Other Co",
              email: "desk@other.test",
              country: "ES",
              transferServices: existingTs,
            }
          : null
    )
  );
  Company.findByIdAndUpdate.mockImplementation((id) =>
    lean({
      _id: id,
      name: "Own Co",
      email: "desk@own.test",
      country: "ES",
      transferServices: existingTs,
      deliveryPricing: { operatingCities: ["Malaga"] },
      offices: [],
    })
  );
  Car.find.mockReturnValue({
    select: () => ({
      lean: async () => [
        {
          _id: "car1",
          ownerId: OWN,
          model: "Leon",
          class: "economy",
          seats: 5,
          PriceChildSeats: 3,
          isActive: true,
        },
      ],
    }),
  });
});

describe("transfer-services authorization", () => {
  test("company admin cannot edit Stripe/payment configuration", async () => {
    signedInAs(companyAdmin);
    const res = await PATCH(
      request({
        body: {
          companyId: OWN,
          transferServices: {
            enabled: true,
            payments: {
              stripeForPlatformFee: false,
              stripeForCompanyAmount: true,
            },
          },
        },
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(Company.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("superadmin inside company context cannot edit payments", async () => {
    signedInAs({ ...platformAdmin, viewAsCompanyId: OWN });
    const res = await PATCH(
      request({
        body: {
          companyId: OWN,
          transferServices: {
            payments: { stripeForPlatformFee: false },
          },
        },
      })
    );
    expect(res.status).toBe(403);
  });

  test("platform admin can edit payment flags", async () => {
    signedInAs(platformAdmin);
    const res = await PATCH(
      request({
        body: {
          companyId: OWN,
          transferServices: {
            payments: { stripeForPlatformFee: true, stripeForCompanyAmount: true },
          },
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Company.findByIdAndUpdate).toHaveBeenCalled();
  });

  test("company admin cannot read or write another company", async () => {
    signedInAs(companyAdmin);
    const get = await GET(
      request({
        url: `http://localhost/api/admin/transfer-services?companyId=${OTHER}`,
      })
    );
    expect(get.status).toBe(403);

    const patch = await PATCH(
      request({
        body: {
          companyId: OTHER,
          transferServices: { enabled: true },
        },
      })
    );
    expect(patch.status).toBe(403);
    expect(Company.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("GET hides payment flags from company admins", async () => {
    signedInAs(companyAdmin);
    const res = await GET(
      request({
        url: `http://localhost/api/admin/transfer-services?companyId=${OWN}`,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canEditPayments).toBe(false);
    expect(body.transferServices.payments).toBeUndefined();
    expect(body.transferServices.maxPassengers).toBe(4);
  });
});
