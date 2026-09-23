import {
  applyEmailTestingRecipients,
  isEmailTestingMode,
  withEmailTestingSubject,
} from "../emailTestingMode";

describe("emailTestingMode", () => {
  const original = {
    EMAIL_TESTING: process.env.EMAIL_TESTING,
    EMAIL_TEST_ADDRESS: process.env.EMAIL_TEST_ADDRESS,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("production mode leaves recipients unchanged", () => {
    delete process.env.EMAIL_TESTING;
    delete process.env.EMAIL_TEST_ADDRESS;
    expect(isEmailTestingMode()).toBe(false);
    const result = applyEmailTestingRecipients({
      to: ["customer@example.com"],
      cc: ["partner@example.com"],
    });
    expect(result).toEqual({
      deliver: true,
      to: ["customer@example.com"],
      cc: ["partner@example.com"],
      intendedTo: ["customer@example.com"],
      intendedCc: ["partner@example.com"],
      redirected: false,
      subjectPrefix: "",
    });
  });

  test("EMAIL_TESTING without sink skips delivery and keeps intended recipients", () => {
    process.env.EMAIL_TESTING = "true";
    delete process.env.EMAIL_TEST_ADDRESS;
    const result = applyEmailTestingRecipients({
      to: ["customer@example.com", "admin@example.com"],
      cc: ["partner@example.com"],
    });
    expect(result.deliver).toBe(false);
    expect(result.to).toEqual([]);
    expect(result.cc).toEqual([]);
    expect(result.intendedTo).toEqual([
      "customer@example.com",
      "admin@example.com",
    ]);
    expect(result.intendedCc).toEqual(["partner@example.com"]);
    expect(result.redirected).toBe(false);
    expect(withEmailTestingSubject("Hello", result.subjectPrefix)).toBe(
      "[TEST] Hello"
    );
  });

  test("EMAIL_TESTING with sink redirects only to EMAIL_TEST_ADDRESS", () => {
    process.env.EMAIL_TESTING = "true";
    process.env.EMAIL_TEST_ADDRESS = "qa-sink@example.com";
    const result = applyEmailTestingRecipients({
      to: ["customer@example.com"],
      cc: ["partner@example.com"],
    });
    expect(result.deliver).toBe(true);
    expect(result.to).toEqual(["qa-sink@example.com"]);
    expect(result.cc).toEqual([]);
    expect(result.intendedTo).toEqual(["customer@example.com"]);
    expect(result.redirected).toBe(true);
    expect(result.to).not.toContain("customer@example.com");
    expect(result.to).not.toContain("partner@example.com");
  });
});
