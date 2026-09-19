/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({
  connectToDB: jest.fn(),
}));

jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("@/lib/email/sendDirect", () => ({
  sendEmailDirect: jest.fn(),
}));

jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  contactRateLimitOptions: jest.fn(() => ({ tableName: "contactRateLimit" })),
}));

jest.mock("@config/email", () => {
  const actual = jest.requireActual("@config/email");
  return {
    ...actual,
    DEVELOPER_EMAIL: "ops@example.com",
    getInternalNotificationEmail: () => "ops@example.com",
  };
});

import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { POST } from "../route";

function contactRequest(body) {
  return new Request("https://carsnk.gr/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectToDB.mockResolvedValue(undefined);
    consumePublicPostOrError.mockResolvedValue(null);
    sendEmailDirect.mockResolvedValue({ messageId: "c1" });
    Company.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({ email: "company@example.com" }),
      }),
    });
  });

  test("ignores client-supplied recipient and html", async () => {
    const res = await POST(
      contactRequest({
        name: "Alex",
        email: "alex@example.com",
        subject: "Hello",
        message: "Need a car",
        to: ["attacker@evil.test"],
        html: "<script>alert(1)</script>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.to).toEqual(["ops@example.com", "company@example.com"]);
    expect(payload.to).not.toContain("attacker@evil.test");
    expect(payload.html).toBeUndefined();
    expect(payload.message).toContain("Need a car");
    expect(payload.message).not.toContain("<script>");
    expect(payload.replyTo).toBe("alex@example.com");
    expect(payload.from).toBeUndefined();
    expect(payload.sender).toBeUndefined();
    expect(payload.envelope).toBeUndefined();
  });

  test("rejects header injection in customer email and subject", async () => {
    const injected = await POST(
      contactRequest({
        name: "Alex",
        email: "alex@example.com\r\nBcc: victim@example.com",
        subject: "Hello",
        message: "Need a car",
      })
    );
    expect(injected.status).toBe(400);
    expect(sendEmailDirect).not.toHaveBeenCalled();

    const subjectInjected = await POST(
      contactRequest({
        name: "Alex",
        email: "alex@example.com",
        subject: "Hello\r\nBcc: victim@example.com",
        message: "Need a car",
      })
    );
    expect(subjectInjected.status).toBe(400);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("keeps a server-controlled recipient when company lookup fails", async () => {
    Company.findById.mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    });
    const res = await POST(
      contactRequest({
        name: "Alex",
        email: "alex@example.com",
        message: "Need a car",
      })
    );
    expect(res.status).toBe(200);
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.to).toEqual(["ops@example.com"]);
    expect(payload.replyTo).toBe("alex@example.com");
  });
});
