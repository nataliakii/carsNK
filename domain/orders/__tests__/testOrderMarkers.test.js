const {
  withTestOrderEmailSubject,
  withTestOrderTelegramMessage,
} = require("../testOrderMarkers");

describe("testOrderMarkers", () => {
  test("withTestOrderEmailSubject idempotent", () => {
    expect(withTestOrderEmailSubject("Hello", false)).toBe("Hello");
    expect(withTestOrderEmailSubject("Hello", true)).toBe("[TEST] Hello");
    expect(withTestOrderEmailSubject("[TEST] Hello", true)).toBe("[TEST] Hello");
  });

  test("withTestOrderTelegramMessage", () => {
    expect(withTestOrderTelegramMessage("x", false)).toBe("x");
    expect(withTestOrderTelegramMessage("a\nb", true)).toBe("[TEST]\n\na\nb");
    expect(withTestOrderTelegramMessage("[TEST]\n\nx", true)).toBe("[TEST]\n\nx");
  });
});
