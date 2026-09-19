/**
 * @jest-environment node
 */
jest.mock("@/lib/adminAuth", () => ({
  requireSuperAdmin: jest.fn(),
}));

jest.mock("@lib/database", () => ({
  connectToDB: jest.fn(),
}));

jest.mock("@/lib/email/sendDirect", () => ({
  sendEmailDirect: jest.fn(),
}));

jest.mock("@models/auditLog", () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));

jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  sendEmailRateLimitOptions: jest.fn(() => ({ tableName: "sendEmailRateLimit" })),
}));

import { requireSuperAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import AuditLog from "@models/auditLog";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { ROLE } from "@models/user";
import { POST } from "../route";

function requestWith(body, { headers } = {}) {
  return new Request("https://carsnk.gr/api/sendEmail", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sendEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ORDER_CONFIRMATION_INTERNAL_PASSWORD;
    connectToDB.mockResolvedValue(undefined);
    consumePublicPostOrError.mockResolvedValue(null);
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
    AuditLog.create.mockResolvedValue({});
  });

  test("returns 401 without admin session or internal password", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await POST(
      requestWith({
        title: "hi",
        message: "body",
        to: ["attacker@example.com"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("returns 403 for supplier admin", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Forbidden — superadmin only" }),
        { status: 403 }
      ),
    });

    const res = await POST(
      requestWith({
        title: "hi",
        message: "body",
        to: ["partner@example.com"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toMatch(/superadmin/i);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("superadmin can send to a validated recipient", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: {
        user: { email: "ops@example.com", role: ROLE.SUPERADMIN, isAdmin: true },
      },
      errorResponse: null,
    });

    const res = await POST(
      requestWith({
        title: "Ops note",
        message: "Please review",
        to: ["ops-target@example.com"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("Email sent");
    expect(sendEmailDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ops note",
        message: "Please review",
        to: ["ops-target@example.com"],
      })
    );
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test("rejects invalid recipient", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: {
        user: { email: "ops@example.com", role: ROLE.SUPERADMIN, isAdmin: true },
      },
      errorResponse: null,
    });

    const res = await POST(
      requestWith({
        title: "Ops note",
        message: "Please review",
        to: ["not-an-email"],
      })
    );
    expect(res.status).toBe(400);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("rejects header injection in subject and recipient", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: {
        user: { email: "ops@example.com", role: ROLE.SUPERADMIN, isAdmin: true },
      },
      errorResponse: null,
    });

    const subjectRes = await POST(
      requestWith({
        title: "Hello\r\nBcc: victim@example.com",
        message: "body",
        to: ["ops-target@example.com"],
      })
    );
    expect(subjectRes.status).toBe(400);

    const toRes = await POST(
      requestWith({
        title: "Hello",
        message: "body",
        to: ["ops-target@example.com\r\nBcc: victim@example.com"],
      })
    );
    expect(toRes.status).toBe(400);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("returns 429 when rate limit exceeded", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: {
        user: { email: "ops@example.com", role: ROLE.SUPERADMIN, isAdmin: true },
      },
      errorResponse: null,
    });
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, message: "Too many requests", code: "RATE_LIMIT" },
    });

    const res = await POST(
      requestWith({
        title: "Ops note",
        message: "Please review",
        to: ["ops-target@example.com"],
      })
    );
    expect(res.status).toBe(429);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });
});
