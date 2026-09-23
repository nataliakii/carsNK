/**
 * @jest-environment node
 */
import {
  parseOptionalCustomerEmail,
  parseRequiredCustomerEmail,
} from "../customerEmail";

describe("parseRequiredCustomerEmail", () => {
  test("rejects empty and whitespace", () => {
    expect(parseRequiredCustomerEmail("")).toMatchObject({
      ok: false,
      code: "required",
    });
    expect(parseRequiredCustomerEmail("   ")).toMatchObject({
      ok: false,
      code: "required",
    });
    expect(parseRequiredCustomerEmail(null)).toMatchObject({
      ok: false,
      code: "required",
    });
  });

  test("rejects invalid format", () => {
    expect(parseRequiredCustomerEmail("not-an-email")).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(parseRequiredCustomerEmail("a@b")).toMatchObject({
      ok: false,
      code: "invalid",
    });
  });

  test("normalizes a valid address", () => {
    expect(parseRequiredCustomerEmail("  Customer@Example.com ")).toEqual({
      ok: true,
      email: "customer@example.com",
    });
  });
});

describe("parseOptionalCustomerEmail", () => {
  test("allows empty", () => {
    expect(parseOptionalCustomerEmail("")).toEqual({ ok: true, email: "" });
  });

  test("still rejects invalid when present", () => {
    expect(parseOptionalCustomerEmail("nope")).toMatchObject({
      ok: false,
      code: "invalid",
    });
  });
});
