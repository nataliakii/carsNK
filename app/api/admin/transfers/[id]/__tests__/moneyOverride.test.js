/**
 * @jest-environment node
 *
 * The transfer money overrides an admin actually has today live on this route.
 * Locking the public submission path down must not close them.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/domain/transfers/transferOps", () => ({
  cancelTransferBySupplier: jest.fn(),
  reopenTransferForClaim: jest.fn(),
  extendTransferOffer: jest.fn(),
  overrideSupplierPayout: jest.fn(),
}));
jest.mock("@/domain/transfers/claimTransfer", () => ({
  claimTransferLead: jest.fn(),
  redactUnclaimedPartnerPii: jest.fn((doc) => doc),
}));
jest.mock("@/domain/transfers/notifyTransferEmails", () => ({
  notifyTransferEmails: jest.fn(),
}));
jest.mock("@/domain/transfers/afterClaim", () => ({
  afterTransferClaimed: jest.fn(),
}));
jest.mock("@/domain/transfers/stripeCheckout", () => ({
  createTransferCheckoutSession: jest.fn(),
}));
jest.mock("@/domain/transfers/eligibility", () => ({
  findEligibleTransferCompanies: jest.fn(async () => []),
}));
jest.mock("@models/Transfer", () => {
  const actual = jest.requireActual("@models/Transfer");
  return {
    ...actual,
    __esModule: true,
    default: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
  };
});

import { requireAdmin } from "@/lib/adminAuth";
import { ROLE } from "@models/user";
import { overrideSupplierPayout } from "@/domain/transfers/transferOps";
import { PATCH } from "../route";

const TRANSFER_ID = "64b7f2c3a1b2c3d4e5f60733";
const COMPANY_ID = "64b7f2c3a1b2c3d4e5f60711";

const superAdmin = {
  isAdmin: true,
  role: ROLE.SUPERADMIN,
  email: "root@rovaro.test",
};

const companyAdmin = {
  isAdmin: true,
  role: ROLE.ADMIN,
  email: "admin@partner.test",
  ownerId: COMPANY_ID,
};

function signedInAs(user) {
  requireAdmin.mockResolvedValue({ session: { user }, errorResponse: null });
}

function request(body) {
  return {
    url: `http://localhost/api/admin/transfers/${TRANSFER_ID}`,
    cookies: { get: () => undefined },
    json: async () => body,
  };
}

const overridePayoutBody = {
  action: "override_payout",
  supplierPayoutMinor: 6000,
  reason: "Agreed with the partner by phone",
};

beforeEach(() => {
  jest.clearAllMocks();
  overrideSupplierPayout.mockResolvedValue({
    ok: true,
    transfer: {
      _id: TRANSFER_ID,
      quoteSnapshot: {
        customerPriceMinor: 9900,
        supplierPayoutMinor: 6000,
        platformMarginMinor: 3900,
        adminOverrideReason: overridePayoutBody.reason,
      },
    },
  });
});

describe("PATCH /api/admin/transfers/[id] override_payout", () => {
  test("a superadmin can still override the payout with a reason", async () => {
    signedInAs(superAdmin);

    const res = await PATCH(request(overridePayoutBody), {
      params: { id: TRANSFER_ID },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(overrideSupplierPayout).toHaveBeenCalledWith({
      transferId: TRANSFER_ID,
      supplierPayoutMinor: 6000,
      reason: overridePayoutBody.reason,
      actorEmail: superAdmin.email,
    });
    expect(body.item.quoteSnapshot.supplierPayoutMinor).toBe(6000);
    expect(body.item.quoteSnapshot.adminOverrideReason).toBe(
      overridePayoutBody.reason
    );
  });

  test("a partner admin is refused and no money moves", async () => {
    signedInAs(companyAdmin);

    const res = await PATCH(request(overridePayoutBody), {
      params: { id: TRANSFER_ID },
    });

    expect(res.status).toBe(403);
    expect(overrideSupplierPayout).not.toHaveBeenCalled();
  });

  test("an unauthenticated caller is refused", async () => {
    requireAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await PATCH(request(overridePayoutBody), {
      params: { id: TRANSFER_ID },
    });

    expect(res.status).toBe(401);
    expect(overrideSupplierPayout).not.toHaveBeenCalled();
  });
});
