/**
 * Emails carry the Rovaro brand for the customer and identify the legal
 * operator in the footer.
 */

function loadSignature({ country = "ES" } = {}) {
  process.env.NEXT_PUBLIC_SITE_COUNTRY = country;
  let mod;
  jest.isolateModules(() => {
    mod = require("@app/ui/email/templates/signature");
  });
  return mod;
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;
const ORIGINAL_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS;

afterAll(() => {
  if (ORIGINAL_COUNTRY === undefined) delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  else process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  if (ORIGINAL_ADDRESS === undefined)
    delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS;
  else process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = ORIGINAL_ADDRESS;
});

describe("Rovaro email legal footer", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS;
    delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER;
  });

  it("shows the brand to the customer and the operator in the footer", () => {
    const { EMAIL_SIGNATURE_TEXT, EMAIL_SIGNATURE_HTML } = loadSignature();

    expect(EMAIL_SIGNATURE_TEXT).toContain("rovaro");
    expect(EMAIL_SIGNATURE_TEXT).toContain(
      "Operated by Nataliia Kirejeva, trading as NK Platform Studio"
    );
    expect(EMAIL_SIGNATURE_TEXT).toContain("admin@rovaro.autos");
    expect(EMAIL_SIGNATURE_HTML).toContain("NK Platform Studio");
  });

  it("omits the address line until one is configured", () => {
    const { EMAIL_SIGNATURE_TEXT } = loadSignature();
    expect(EMAIL_SIGNATURE_TEXT).not.toMatch(/Business address/);
    expect(EMAIL_SIGNATURE_TEXT).not.toMatch(/INSERT/i);
  });

  it("includes the address once configured", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "A configured address";
    const { EMAIL_SIGNATURE_TEXT } = loadSignature();
    expect(EMAIL_SIGNATURE_TEXT).toContain("Business address: A configured address");
  });

  it("leaves the Greek CarsNK deployment untouched", () => {
    const { EMAIL_SIGNATURE_TEXT } = loadSignature({ country: "GR" });
    expect(EMAIL_SIGNATURE_TEXT).not.toContain("NK Platform Studio");
    expect(EMAIL_SIGNATURE_TEXT).toContain("CarsNK");
  });
});
