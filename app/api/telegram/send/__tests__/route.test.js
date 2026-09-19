/**
 * @jest-environment node
 */
jest.mock("@/lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/telegram/sendDirect", () => ({
  sendTelegramDirect: jest.fn(),
}));

import { requireAdmin } from "@/lib/adminAuth";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { POST } from "../route";

describe("POST /api/telegram/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 403 without admin session", async () => {
    requireAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    });

    const request = new Request("https://carsnk.gr/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "/evil",
        message: "hi",
      }),
    });

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(sendTelegramDirect).not.toHaveBeenCalled();
    expect(body.error).toBe("Forbidden");
  });
});
