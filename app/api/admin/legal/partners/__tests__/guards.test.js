/**
 * @jest-environment node
 *
 * Authorization for the platform partner-review endpoints.
 *
 * These assert real status codes from the real route handlers rather than
 * the shape of the source, so hiding a button can never be mistaken for
 * securing the mutation behind it.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));

import { getServerSession } from "next-auth/next";
import { ROLE } from "@models/user";
import { ADMIN_VIEW_AS_COOKIE } from "@/domain/owners/adminViewAsShared";

import { GET as listPartners } from "../route";
import { GET as getPartner, PATCH as patchPartner } from "../[companyId]/route";

const OWN = "64b7f2c3a1b2c3d4e5f60711";
const OTHER = "64b7f2c3a1b2c3d4e5f60722";

function signedInAs(user) {
  getServerSession.mockResolvedValue({ user });
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

/** A request carrying the view-as cookie, i.e. "inside a company". */
function request({ viewAs = "", body = null, url = "http://localhost/x" } = {}) {
  const req = {
    url,
    nextUrl: new URL(url),
    cookies: {
      get: (name) =>
        name === ADMIN_VIEW_AS_COOKIE && viewAs ? { value: viewAs } : undefined,
    },
    headers: new Headers(),
    json: async () => {
      if (body === null) throw new Error("no body");
      return body;
    },
  };
  return req;
}

const params = (companyId) => ({ params: Promise.resolve({ companyId }) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("platform partner review authorization", () => {
  it("2. Company ADMIN cannot call verification or suspension APIs", async () => {
    signedInAs(companyAdmin);
    const res = await patchPartner(
      request({ body: { status: "VERIFIED" } }),
      params(OWN)
    );
    expect(res.status).toBe(403);

    signedInAs(companyAdmin);
    const suspend = await patchPartner(
      request({ body: { status: "SUSPENDED", reason: "x" } }),
      params(OWN)
    );
    expect(suspend.status).toBe(403);

    signedInAs(companyAdmin);
    const list = await listPartners(
      request({ url: "http://localhost/api/admin/legal/partners" })
    );
    expect(list.status).toBe(403);
  });

  it("4. SUPERADMIN inside company context cannot call platform review mutations", async () => {
    for (const body of [
      { status: "VERIFIED" },
      { status: "REJECTED", reason: "x" },
      { status: "SUSPENDED", reason: "x" },
      { action: "apply_pending_changes" },
      { action: "discard_pending_changes" },
      { action: "terminate_agreement" },
    ]) {
      signedInAs(platformAdmin);
      const res = await patchPartner(
        request({ viewAs: OWN, body }),
        params(OWN)
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("company_context");
    }
  });

  it("4b. Reading the review queue also requires leaving company mode", async () => {
    signedInAs(platformAdmin);
    const list = await listPartners(
      request({
        viewAs: OWN,
        url: "http://localhost/api/admin/legal/partners?summary=1",
      })
    );
    expect(list.status).toBe(403);

    signedInAs(platformAdmin);
    const detail = await getPartner(request({ viewAs: OWN }), params(OWN));
    expect(detail.status).toBe(403);
  });

  it("5. SUPERADMIN outside company context passes the review guard", async () => {
    // An invalid id proves the guard let the request through to validation.
    signedInAs(platformAdmin);
    const res = await patchPartner(
      request({ body: { status: "VERIFIED" } }),
      params("not-an-object-id")
    );
    expect(res.status).toBe(400);
  });

  it("14. Forged companyId, role and mode in the body are ignored", async () => {
    // Role and view mode are never read from the request.
    signedInAs(companyAdmin);
    const escalated = await patchPartner(
      request({
        body: {
          status: "VERIFIED",
          role: ROLE.SUPERADMIN,
          isAdmin: true,
          viewMode: "PLATFORM_ADMIN_MODE",
          companyId: OTHER,
        },
      }),
      params(OTHER)
    );
    expect(escalated.status).toBe(403);

    // A superadmin in company context cannot escape by naming another company
    // in the body or by claiming platform mode.
    signedInAs(platformAdmin);
    const forged = await patchPartner(
      request({
        viewAs: OWN,
        body: {
          status: "VERIFIED",
          companyId: OTHER,
          viewMode: "PLATFORM_ADMIN_MODE",
          viewAsCompanyId: null,
        },
      }),
      params(OTHER)
    );
    expect(forged.status).toBe(403);
    expect((await forged.json()).code).toBe("company_context");
  });

  it("14b. A non-admin session is rejected before any company lookup", async () => {
    getServerSession.mockResolvedValue({ user: { email: "guest@test" } });
    const res = await patchPartner(
      request({ body: { status: "VERIFIED" } }),
      params(OWN)
    );
    expect(res.status).toBe(401);
  });
});
