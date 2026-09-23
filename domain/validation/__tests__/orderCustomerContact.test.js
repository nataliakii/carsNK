/**
 * @jest-environment node
 */
import { parseOrderCustomerContact } from "../orderCustomerContact";
import { parseCustomerPhone } from "../customerPhone";

describe("parseCustomerPhone", () => {
  test("required rejects empty", () => {
    expect(parseCustomerPhone("")).toMatchObject({
      ok: false,
      code: "required",
      message: "Invalid phone number",
    });
    expect(parseCustomerPhone("   ")).toMatchObject({ ok: false, code: "required" });
  });

  test("required rejects invalid format", () => {
    expect(parseCustomerPhone("123")).toMatchObject({
      ok: false,
      code: "invalid",
      messageKey: "order.phoneInvalid",
    });
  });

  test("required accepts a valid international number", () => {
    expect(parseCustomerPhone("+30 697 123 4567")).toEqual({
      ok: true,
      phone: "+30 697 123 4567",
    });
  });

  test("optional empty is allowed", () => {
    expect(parseCustomerPhone("", { required: false })).toEqual({
      ok: true,
      phone: "",
    });
  });

  test("skipFormat allows garbage when present", () => {
    expect(
      parseCustomerPhone("note", { required: false, skipFormat: true })
    ).toEqual({ ok: true, phone: "note" });
  });
});

describe("parseOrderCustomerContact offline = no required customer fields", () => {
  test("allows empty name, phone, and email", () => {
    expect(
      parseOrderCustomerContact({
        offline: true,
        customerName: "",
        phone: "",
        email: "",
      })
    ).toEqual({
      ok: true,
      customerName: "",
      phone: "",
      email: "",
    });
  });

  test("allows a non-E.164 phone stub", () => {
    expect(
      parseOrderCustomerContact({
        offline: true,
        customerName: "",
        phone: "wa later",
        email: "",
      })
    ).toEqual({
      ok: true,
      customerName: "",
      phone: "wa later",
      email: "",
    });
  });

  test("still rejects a filled invalid email", () => {
    expect(
      parseOrderCustomerContact({
        offline: true,
        email: "not-an-email",
        phone: "",
      })
    ).toMatchObject({
      ok: false,
      field: "email",
      code: "invalid",
      messageKey: "order.emailInvalid",
    });
  });

  test("normalizes a filled valid email", () => {
    expect(
      parseOrderCustomerContact({
        offline: true,
        email: "  Guest@Example.com ",
        phone: "",
      })
    ).toEqual({
      ok: true,
      customerName: "",
      phone: "",
      email: "guest@example.com",
    });
  });
});

describe("parseOrderCustomerContact online", () => {
  test("requires a valid phone and email", () => {
    expect(
      parseOrderCustomerContact({
        offline: false,
        phone: "",
        email: "",
      })
    ).toMatchObject({ ok: false, field: "phone", code: "required" });

    expect(
      parseOrderCustomerContact({
        offline: false,
        phone: "+30 697 123 4567",
        email: "",
      })
    ).toMatchObject({ ok: false, field: "email", code: "required" });
  });

  test("accepts valid phone and email", () => {
    expect(
      parseOrderCustomerContact({
        offline: false,
        customerName: "Ada",
        phone: "+30 697 123 4567",
        email: "ada@example.com",
      })
    ).toEqual({
      ok: true,
      customerName: "Ada",
      phone: "+30 697 123 4567",
      email: "ada@example.com",
    });
  });

  test("update path: empty phone is allowed when requirePhone is false", () => {
    expect(
      parseOrderCustomerContact({
        offline: false,
        requirePhone: false,
        phone: "",
        email: "ada@example.com",
      })
    ).toEqual({
      ok: true,
      customerName: "",
      phone: "",
      email: "ada@example.com",
    });
  });
});
