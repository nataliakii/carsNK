/**
 * Token substitution and the suppression rule that keeps unconfigured legal
 * values out of customer- and partner-facing output.
 */

function loadTokens() {
  let mod;
  jest.isolateModules(() => {
    mod = require("@/domain/legal/tokens");
  });
  return mod;
}

function docWithSections(sections) {
  return { content: { title: "{{operator.platformBrand}} Terms", sections } };
}

describe("token substitution", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS;
    delete process.env.NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS;
    delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER;
  });

  it("resolves operator tokens from the single source of truth", () => {
    const { renderLegalDocument } = loadTokens();
    const rendered = renderLegalDocument(
      docWithSections([
        { id: "1", heading: "About", body: "{{operator.platformSentence}}" },
        { id: "2", heading: "Contact", body: "Write to {{operator.legalEmail}}." },
      ])
    );

    expect(rendered.title).toBe("Rovaro Terms");
    expect(rendered.sections[0].text).toBe(
      "Rovaro is an online booking platform operated by Nataliia Kirejeva, a sole trader established in Ireland, trading as NK Platform Studio."
    );
    expect(rendered.sections[1].text).toBe("Write to admin@rovaro.autos.");
  });

  it("substitutes settings tokens supplied by the caller", () => {
    const { renderLegalDocument } = loadTokens();
    const rendered = renderLegalDocument(
      docWithSections([
        {
          id: "1",
          heading: "Response",
          body: "Answer within {{settings.standardRequestResponseHours}} hours.",
        },
      ]),
      { settings: { standardRequestResponseHours: 12 } }
    );

    expect(rendered.sections[0].text).toBe("Answer within 12 hours.");
  });

  it("drops a section whose configurable value is missing", () => {
    const { renderLegalDocument } = loadTokens();
    const rendered = renderLegalDocument(
      docWithSections([
        { id: "1", heading: "About", body: "Always visible." },
        {
          id: "2",
          heading: "Address",
          body: "Our address is {{operator.businessAddress}}.",
          requires: ["businessAddress"],
        },
      ])
    );

    expect(rendered.sections).toHaveLength(1);
    expect(rendered.sections[0].id).toBe("1");
    // Critically: no empty "Our address is ." sentence reaches the reader.
    expect(JSON.stringify(rendered)).not.toContain("Our address is");
  });

  it("shows the section once the value is configured", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "A configured address";
    const { renderLegalDocument } = loadTokens();
    const rendered = renderLegalDocument(
      docWithSections([
        {
          id: "2",
          heading: "Address",
          body: "Our address is {{operator.businessAddress}}.",
          requires: ["businessAddress"],
        },
      ])
    );

    expect(rendered.sections).toHaveLength(1);
    expect(rendered.sections[0].text).toBe("Our address is A configured address.");
  });

  it("reports suppressed sections for the superadmin panel only", () => {
    const { findSuppressedSections } = loadTokens();
    const suppressed = findSuppressedSections(
      docWithSections([
        { id: "1", heading: "About", body: "x" },
        { id: "2", heading: "Address", body: "y", requires: ["businessAddress"] },
      ])
    );

    expect(suppressed).toHaveLength(1);
    expect(suppressed[0]).toMatchObject({
      id: "2",
      requires: ["businessAddress"],
    });
  });

  it("resolves the payment processor name token", () => {
    const { renderLegalDocument } = loadTokens();
    const rendered = renderLegalDocument(
      docWithSections([
        {
          id: "1",
          heading: "Payment",
          body: "Fees are paid through {{operator.paymentProcessorName}}.",
        },
      ])
    );

    expect(rendered.sections[0].text).toBe("Fees are paid through Stripe.");
  });

  it("leaves an unknown token untouched rather than blanking it", () => {
    const { substituteTokens } = loadTokens();
    expect(substituteTokens("{{unknown.thing}}", {})).toBe("{{unknown.thing}}");
  });

  it("never exposes a tax identifier through the token map", () => {
    process.env.LEGAL_VAT_NUMBER = "IE1234567AB";
    const { buildTokenValues } = loadTokens();
    const values = buildTokenValues();

    expect(JSON.stringify(values)).not.toContain("IE1234567AB");
    expect(Object.keys(values)).not.toContain("operator.vatNumber");
    delete process.env.LEGAL_VAT_NUMBER;
  });
});
