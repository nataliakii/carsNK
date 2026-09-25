import {
  COMPANY_NOTES_MAX_LENGTH,
  COMPANY_TAGS_MAX_COUNT,
  COMPANY_TAG_MAX_LENGTH,
  applyCompanyInternalMeta,
  normalizeCompanyNotes,
  normalizeCompanyTags,
} from "../companyInternalMeta";

describe("companyInternalMeta", () => {
  test("trims and caps notes", () => {
    expect(normalizeCompanyNotes("  hello  ")).toBe("hello");
    expect(normalizeCompanyNotes("x".repeat(COMPANY_NOTES_MAX_LENGTH + 50))).toHaveLength(
      COMPANY_NOTES_MAX_LENGTH
    );
  });

  test("normalizes freeform tags with dedupe", () => {
    expect(
      normalizeCompanyTags([" paid ", "bob-confirmed", "PAID", "x".repeat(40)])
    ).toEqual(["paid", "bob-confirmed", "x".repeat(COMPANY_TAG_MAX_LENGTH)]);
  });

  test("parses comma-separated tag strings", () => {
    expect(normalizeCompanyTags("paid, bob-confirmed; deposit")).toEqual([
      "paid",
      "bob-confirmed",
      "deposit",
    ]);
  });

  test("caps tag count", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`);
    expect(normalizeCompanyTags(many)).toHaveLength(COMPANY_TAGS_MAX_COUNT);
  });

  test("applyCompanyInternalMeta only writes when internal", () => {
    const order = { companyNotes: "", companyTags: [] };
    expect(
      applyCompanyInternalMeta(
        order,
        { companyNotes: "n", companyTags: ["paid"] },
        { isInternal: false }
      )
    ).toBe(false);
    expect(order.companyNotes).toBe("");

    expect(
      applyCompanyInternalMeta(
        order,
        { companyNotes: "n", companyTags: ["paid"] },
        { isInternal: true }
      )
    ).toBe(true);
    expect(order.companyNotes).toBe("n");
    expect(order.companyTags).toEqual(["paid"]);
  });
});
