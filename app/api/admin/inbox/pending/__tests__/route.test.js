/**
 * @jest-environment node
 *
 * Company inbox scope and shared counts. No Mongo, mail, or legal publishing.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@lib/adminAuth", () => ({ getServerSessionWithViewAs: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { countDocuments: jest.fn() } }));
jest.mock("@models/Transfer", () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/car", () => ({
  Car: { find: jest.fn() },
}));
jest.mock("@models/PartnerLegalProfile", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("@/domain/legal/agreementService", () => ({
  resolveCurrentPartnerPackage: jest.fn(),
}));
jest.mock("@/domain/orders/pendingInbox", () => {
  const actual = jest.requireActual("@/domain/orders/pendingInbox");
  return {
    ...actual,
    buildPendingRentalsFilter: jest.fn(() => ({})),
    buildPendingTransfersFilter: jest.fn(() => ({})),
    resolveAdminCountryOwnerIds: jest.fn(async () => null),
  };
});

import { ROLE } from "@models/user";
import { getServerSessionWithViewAs } from "@lib/adminAuth";
import { Order } from "@models/order";
import Transfer from "@models/Transfer";
import Company from "@models/company";
import { Car } from "@models/car";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import { resolveCurrentPartnerPackage } from "@/domain/legal/agreementService";
import { withAdminViewAs } from "@/domain/owners/adminViewAs";
import { GET } from "../route";

const OWN = "64b7f2c3a1b2c3d4e5f60711";
const OTHER = "64b7f2c3a1b2c3d4e5f60722";

function lean(value) {
  return { select: () => ({ lean: async () => value }) };
}

function emptyTransferFind() {
  Transfer.find.mockReturnValue({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    }),
  });
}

function publishedPackage(state = "ACCEPTANCE_REQUIRED") {
  return {
    complete: true,
    anyDraft: false,
    packageChecksum: "pkg-current",
    manifest: [
      {
        type: "PARTNER_AGREEMENT",
        documentId: "a",
        version: 1,
        checksum: "a1",
      },
      {
        type: "PARTNER_OPERATING_RULES",
        documentId: "b",
        version: 1,
        checksum: "b1",
      },
      {
        type: "DATA_PROTECTION_SCHEDULE",
        documentId: "c",
        version: 1,
        checksum: "c1",
      },
    ],
    legalState: {
      state,
      legalActionCount: state === "ACCEPTANCE_REQUIRED" ? 1 : 0,
      changedDocumentTypes: [],
      missingDocumentTypes: [],
    },
    latestAcceptance:
      state === "ACCEPTED_CURRENT" ? { packageChecksum: "pkg-current" } : null,
  };
}

function request(query = "") {
  return new Request(`http://localhost/api/admin/inbox/pending${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  Order.countDocuments.mockResolvedValue(3);
  Transfer.countDocuments.mockResolvedValue(0);
  emptyTransferFind();
  Car.find.mockReturnValue(lean([]));
  Company.findById.mockReturnValue(
    lean({
      _id: OWN,
      country: "ES",
      email: "desk@own.test",
      transferServices: {
        enabled: true,
        supplierAgreementAcceptedAt: new Date(),
      },
      deliveryPricing: { operatingCities: [] },
      offices: [],
    })
  );
  PartnerLegalProfile.findOne.mockImplementation(({ companyId }) =>
    lean({ companyId, verificationStatus: "VERIFIED", documents: [] })
  );
  resolveCurrentPartnerPackage.mockImplementation(async ({ companyId }) => ({
    ...publishedPackage(),
    company: { _id: companyId },
  }));
});

describe("GET /api/admin/inbox/pending", () => {
  it("returns one shared response: orders 3, setup 1, bell 4", async () => {
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: OWN },
    });
    const body = await (await GET(request())).json();
    expect(body.ordersBadge).toBe(3);
    expect(body.bookings.count).toBe(3);
    expect(body.companySetup.count).toBe(1);
    expect(body.companySetup.tasks[0]).toMatchObject({
      id: "TERMS_READY_TO_ACCEPT",
      title: "Partner terms ready to accept",
      href: "/admin/company/setup?step=details",
    });
    expect(body.total).toBe(body.bookings.count + body.companySetup.count);
    expect(body.total).toBe(4);
    expect(Transfer.find).toHaveBeenCalled();
    expect(Transfer.countDocuments).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/pkg-current|checksum|ipAddress/i);
  });

  it("13. a company ADMIN cannot read another company's tasks via the query", async () => {
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: OWN },
    });
    await GET(request(`?companyId=${OTHER}&ownerId=${OTHER}`));
    const queried = PartnerLegalProfile.findOne.mock.calls.map(([filter]) =>
      String(filter.companyId)
    );
    expect(queried).toEqual([OWN]);
    expect(resolveCurrentPartnerPackage).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: OWN, requestedLocale: "en" })
    );
  });

  it("13. a company ADMIN cannot borrow the superadmin view-as scope", async () => {
    expect(
      withAdminViewAs(
        { user: { isAdmin: true, role: ROLE.ADMIN, ownerId: OWN } },
        OTHER
      ).user.viewAsCompanyId
    ).toBeUndefined();

    getServerSessionWithViewAs.mockResolvedValue({
      user: {
        isAdmin: true,
        role: ROLE.ADMIN,
        ownerId: OWN,
        viewAsCompanyId: OTHER,
      },
    });
    await GET(request());
    expect(resolveCurrentPartnerPackage).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: OWN, requestedLocale: "en" })
    );
  });

  it("14. SUPERADMIN in company context uses the selected company", async () => {
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.SUPERADMIN, viewAsCompanyId: OTHER },
    });
    const body = await (await GET(request(`?companyId=${OWN}`))).json();
    expect(resolveCurrentPartnerPackage).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: OTHER, requestedLocale: "en" })
    );
    expect(body.companySetup.count).toBe(1);
    expect(Transfer.find).toHaveBeenCalled();
  });

  it("SUPERADMIN outside company context keeps the platform inbox without company tasks", async () => {
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.SUPERADMIN },
    });
    const body = await (await GET(request("?country=ES"))).json();
    expect(PartnerLegalProfile.findOne).not.toHaveBeenCalled();
    expect(body.companySetup.count).toBe(0);
    expect(body.total).toBe(3);
    expect(Transfer.countDocuments).toHaveBeenCalled();
  });

  it("4. unpublished terms do not raise the bell or the legal badge", async () => {
    resolveCurrentPartnerPackage.mockImplementation(async ({ companyId }) => ({
      ...publishedPackage("NOT_PUBLISHED"),
      complete: false,
      anyDraft: true,
      company: { _id: companyId },
    }));
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: OWN },
    });
    const body = await (await GET(request())).json();
    expect(body.companySetup.count).toBe(0);
    expect(body.total).toBe(3);
  });

  it("12. accepting the current package removes the task on the next fetch", async () => {
    getServerSessionWithViewAs.mockResolvedValue({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: OWN },
    });
    const before = await (await GET(request())).json();
    resolveCurrentPartnerPackage.mockImplementation(async ({ companyId }) => ({
      ...publishedPackage("ACCEPTED_CURRENT"),
      company: { _id: companyId },
    }));
    const after = await (await GET(request())).json();
    expect(before.total).toBe(4);
    expect(after.ordersBadge).toBe(3);
    expect(after.companySetup.count).toBe(0);
    expect(after.total).toBe(3);
  });
});
