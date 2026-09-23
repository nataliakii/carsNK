/**
 * @jest-environment node
 */
import { notifySuperadmin } from "../notifySuperadmin";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));

describe("notifySuperadmin", () => {
  const originalInternal = process.env.MAIL_INTERNAL_TO;
  const originalAuth = process.env.AUTH_SUPERADMIN_EMAIL;
  const originalCountry = process.env.NEXT_PUBLIC_SITE_COUNTRY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    process.env.MAIL_INTERNAL_TO = "admin@rovaro.autos";
    process.env.AUTH_SUPERADMIN_EMAIL = "ops-login@example.com";
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
    sendTelegramDirect.mockResolvedValue(true);
  });

  afterAll(() => {
    if (originalInternal === undefined) delete process.env.MAIL_INTERNAL_TO;
    else process.env.MAIL_INTERNAL_TO = originalInternal;
    if (originalAuth === undefined) delete process.env.AUTH_SUPERADMIN_EMAIL;
    else process.env.AUTH_SUPERADMIN_EMAIL = originalAuth;
    if (originalCountry === undefined) delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
    else process.env.NEXT_PUBLIC_SITE_COUNTRY = originalCountry;
  });

  test("sends branded HTML to the superadmin inboxes", async () => {
    await notifySuperadmin({
      title: "Partner confirmed availability",
      bodyLines: ["Order #1", "Car: Seat Leon"],
    });

    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.title).toBe("Partner confirmed availability");
    expect(payload.to).toEqual([
      "admin@rovaro.autos",
      "ops-login@example.com",
    ]);
    expect(payload.html).toContain("Order #1");
    expect(payload.html).toContain("rovaro");
    expect(payload.html).toContain("rovaro.autos");
    expect(sendTelegramDirect).toHaveBeenCalled();
  });
});
