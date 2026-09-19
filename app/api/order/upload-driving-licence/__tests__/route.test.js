/**
 * @jest-environment node
 */
jest.mock("@/lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: { uploader: { upload_stream: jest.fn() } },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));

import { requireAdmin } from "@/lib/adminAuth";
import { POST } from "../route";

describe("POST /api/order/upload-driving-licence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("unauthenticated caller gets 403 JSON", async () => {
    requireAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    });

    const request = new Request(
      "https://carsnk.gr/api/order/upload-driving-licence",
      { method: "POST", body: new FormData() }
    );
    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ success: false, message: "Forbidden" });
  });
});
