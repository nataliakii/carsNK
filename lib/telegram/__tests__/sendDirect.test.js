describe("sendTelegramDirect", () => {
  const originalFetch = global.fetch;
  const originalBotUrl = process.env.TELEGRAM_BOT_URL;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  beforeEach(() => {
    jest.resetModules();
    process.env.TELEGRAM_BOT_URL = "https://telegram-proxy.example";
    process.env.TELEGRAM_CHAT_ID = "123456";
    delete process.env.EMAIL_TESTING;
    delete process.env.EMAIL_TESTING_ALLOW_TELEGRAM;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TELEGRAM_BOT_URL = originalBotUrl;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
    delete process.env.EMAIL_TESTING;
    delete process.env.EMAIL_TESTING_ALLOW_TELEGRAM;
  });

  test("disables link previews by default", async () => {
    const { sendTelegramDirect } = await import("@/lib/telegram/sendDirect");

    const sent = await sendTelegramDirect("https://example.com");

    expect(sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, request] = global.fetch.mock.calls[0];
    expect(JSON.parse(request.body)).toEqual({
      chat_id: 123456,
      message: "https://example.com",
      disable_web_page_preview: true,
      link_preview_options: { is_disabled: true },
    });
  });

  test("allows opting back into link previews", async () => {
    const { sendTelegramDirect } = await import("@/lib/telegram/sendDirect");

    const sent = await sendTelegramDirect(
      "https://example.com",
      undefined,
      { disablePreview: false }
    );

    expect(sent).toBe(true);
    const [, request] = global.fetch.mock.calls[0];
    expect(JSON.parse(request.body)).toEqual({
      chat_id: 123456,
      message: "https://example.com",
    });
  });

  test("EMAIL_TESTING=true blocks Telegram unless explicitly allowed", async () => {
    process.env.EMAIL_TESTING = "true";
    const { sendTelegramDirect } = await import("@/lib/telegram/sendDirect");
    const sent = await sendTelegramDirect("should not send");
    expect(sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();

    jest.resetModules();
    process.env.EMAIL_TESTING_ALLOW_TELEGRAM = "true";
    const { sendTelegramDirect: sendAllowed } = await import(
      "@/lib/telegram/sendDirect"
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const allowed = await sendAllowed("allowed in test");
    expect(allowed).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
