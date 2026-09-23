/**
 * @jest-environment node
 */
import { NextResponse } from "next/server";

jest.mock("@lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@lib/database", () => ({
  connectToDB: jest.fn(),
}));

jest.mock("@models/user", () => ({
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("@/domain/auth/sendPasswordResetEmail", () => ({
  sendPasswordResetEmailToUser: jest.fn(),
}));

import { requireAdmin } from "@lib/adminAuth";
import { User } from "@models/user";
import { sendPasswordResetEmailToUser } from "@/domain/auth/sendPasswordResetEmail";
import { POST } from "../route";

const SESSION_ID = "64b7f0c2a1b2c3d4e5f60789";
const SESSION_EMAIL = "me@example.com";

function sessionUser() {
  return {
    _id: SESSION_ID,
    email: SESSION_EMAIL,
    isAdmin: true,
    save: jest.fn(),
  };
}

describe("POST /api/admin/account/send-password-reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({
      session: {
        user: {
          id: SESSION_ID,
          email: SESSION_EMAIL,
          isAdmin: true,
          role: 2,
        },
      },
      errorResponse: null,
    });
    User.findById.mockResolvedValue(sessionUser());
    User.findOne.mockResolvedValue(null);
    sendPasswordResetEmailToUser.mockResolvedValue(undefined);
  });

  it("emails the session user and ignores a client-supplied address", async () => {
    const req = new Request(
      "https://rovaro.example/api/admin/account/send-password-reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@evil.com" }),
      }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.email).toBe(SESSION_EMAIL);
    expect(User.findById).toHaveBeenCalledWith(SESSION_ID);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailToUser).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailToUser.mock.calls[0][0].email).toBe(
      SESSION_EMAIL
    );
    expect(JSON.stringify(sendPasswordResetEmailToUser.mock.calls[0][0])).not.toContain(
      "other@evil.com"
    );
  });

  it("does not look up an arbitrary email when the session has no user id", async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { email: SESSION_EMAIL, isAdmin: true, role: 1 } },
      errorResponse: null,
    });
    User.findOne.mockResolvedValue(sessionUser());

    const req = new Request(
      "https://rovaro.example/api/admin/account/send-password-reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@evil.com" }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(User.findById).not.toHaveBeenCalled();
    const query = User.findOne.mock.calls[0][0];
    expect(query.isAdmin).toBe(true);
    expect(String(query.email)).toContain(SESSION_EMAIL.replace(".", "\\."));
    expect(String(query.email)).not.toContain("evil");
  });

  it("keeps the existing unauthorized response", async () => {
    const denied = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    requireAdmin.mockResolvedValue({ session: null, errorResponse: denied });

    const res = await POST(
      new Request("https://rovaro.example/api/admin/account/send-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: "other@evil.com" }),
      })
    );

    expect(res.status).toBe(401);
    expect(sendPasswordResetEmailToUser).not.toHaveBeenCalled();
    expect(User.findOne).not.toHaveBeenCalled();
  });
});
