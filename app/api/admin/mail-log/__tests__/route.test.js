/**
 * @jest-environment node
 */
jest.mock("@lib/adminAuth", () => ({ requireSuperAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/mail/queryMailLog", () => ({
  listMailLogs: jest.fn(),
  getMailLogById: jest.fn(),
  serializeMailLogDetail: jest.fn((doc) => doc),
}));
jest.mock("@/domain/mail/resendOutboundMail", () => ({
  resendMailLog: jest.fn(),
}));

import { requireSuperAdmin } from "@lib/adminAuth";
import { listMailLogs } from "@/domain/mail/queryMailLog";
import { resendMailLog } from "@/domain/mail/resendOutboundMail";
import { GET } from "../route";
import { POST as resend } from "../[id]/resend/route";

const LIST = "https://rovaro.autos/api/admin/mail-log";

function unauthenticated() {
  requireSuperAdmin.mockResolvedValue({
    session: null,
    errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });
}

function asSuperadmin() {
  requireSuperAdmin.mockResolvedValue({
    session: { user: { email: "root@rovaro.autos", role: 2 } },
    errorResponse: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  unauthenticated();
});

describe("GET /api/admin/mail-log", () => {
  test("refuses anonymous callers", async () => {
    const res = await GET(new Request(LIST));
    expect(res.status).toBe(401);
    expect(listMailLogs).not.toHaveBeenCalled();
  });

  test("lists mail for superadmin with filters", async () => {
    asSuperadmin();
    listMailLogs.mockResolvedValue({
      items: [{ id: "1", subject: "Hi", to: ["a@b.co"] }],
      total: 1,
      page: 1,
      limit: 50,
    });
    const res = await GET(
      new Request(`${LIST}?orderId=64b7f2c3a1b2c3d4e5f60789&status=sent`)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toHaveLength(1);
    expect(listMailLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "64b7f2c3a1b2c3d4e5f60789",
        status: "sent",
      })
    );
  });
});

describe("POST /api/admin/mail-log/:id/resend", () => {
  test("refuses anonymous callers", async () => {
    const res = await resend(new Request(`${LIST}/abc/resend`), {
      params: { id: "abc" },
    });
    expect(res.status).toBe(401);
    expect(resendMailLog).not.toHaveBeenCalled();
  });

  test("resends for superadmin", async () => {
    asSuperadmin();
    resendMailLog.mockResolvedValue({ ok: true });
    const res = await resend(new Request(`${LIST}/abc/resend`, { method: "POST" }), {
      params: { id: "abc" },
    });
    expect(res.status).toBe(200);
    expect(resendMailLog).toHaveBeenCalledWith("abc");
  });
});
