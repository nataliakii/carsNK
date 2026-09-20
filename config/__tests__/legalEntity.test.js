/**
 * Legal entity rendering and configuration status.
 *
 * The point of these tests is that nothing is ever invented: unconfigured
 * legal values produce an omitted sentence plus a superadmin warning, not a
 * placeholder and not a plausible-looking number.
 */

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS",
  "NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS",
  "NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER",
];
const SERVER_ENV_KEYS = [
  "LEGAL_VAT_NUMBER",
  "LEGAL_TAX_REFERENCE_NUMBER",
  "LEGAL_VAT_REGISTERED",
];

function clearLegalEnv() {
  for (const key of [...PUBLIC_ENV_KEYS, ...SERVER_ENV_KEYS]) {
    delete process.env[key];
  }
}

function loadModule() {
  let mod;
  jest.isolateModules(() => {
    mod = require("@config/legalEntity");
  });
  return mod;
}

describe("legal entity identity", () => {
  beforeEach(() => {
    clearLegalEnv();
  });

  it("uses the confirmed sole-trader identity", () => {
    const { getPublicLegalEntity } = loadModule();
    const entity = getPublicLegalEntity();

    expect(entity.ownerLegalName).toBe("Nataliia Kirejeva");
    expect(entity.legalStructure).toBe("sole_trader");
    expect(entity.countryOfEstablishment).toBe("Ireland");
    expect(entity.tradingName).toBe("NK Platform Studio");
    expect(entity.platformBrand).toBe("Rovaro");
    expect(entity.legalEmail).toBe("admin@rovaro.autos");
    expect(entity.primaryDomain).toBe("rovaro.autos");
    expect(entity.spanishDomain).toBe("rovaro.es");
  });

  it("renders the operator sentence exactly as agreed", () => {
    const { getOperatorLine, getPlatformOperatorSentence } = loadModule();

    expect(getOperatorLine()).toBe(
      "Rovaro is operated by Nataliia Kirejeva, a sole trader established in Ireland, trading as NK Platform Studio."
    );
    expect(getPlatformOperatorSentence()).toBe(
      "Rovaro is an online booking platform operated by Nataliia Kirejeva, a sole trader established in Ireland, trading as NK Platform Studio."
    );
  });

  it("never introduces a corporate suffix or a fabricated entity", () => {
    const { getOperatorLine, getPlatformOperatorSentence } = loadModule();
    const text = `${getOperatorLine()} ${getPlatformOperatorSentence()}`;

    expect(text).not.toMatch(/\bLtd\b/);
    expect(text).not.toMatch(/\bLimited\b/);
    expect(text).not.toMatch(/\bGmbH\b/);
    expect(text).not.toMatch(/\bS\.?L\.?\b/);
    // The brand must never be replaced by the trading name.
    expect(text.startsWith("Rovaro")).toBe(true);
  });

  it("renders the Spanish operator sentence without translating the names", () => {
    const { getOperatorLine, getPlatformOperatorSentence } = loadModule();

    expect(getOperatorLine("es")).toBe(
      "Rovaro es operado por Nataliia Kirejeva, empresaria individual (autónoma) establecida en Irlanda, que opera bajo el nombre comercial NK Platform Studio."
    );
    expect(getPlatformOperatorSentence("es")).toContain(
      "plataforma de reservas online"
    );
    // Identity values are never translated.
    expect(getOperatorLine("es")).toContain("Nataliia Kirejeva");
    expect(getOperatorLine("es")).toContain("NK Platform Studio");
    expect(getOperatorLine("es")).toContain("Rovaro");
  });

  it("falls back to English for a language with no template", () => {
    const { getOperatorLine } = loadModule();
    expect(getOperatorLine("de")).toBe(getOperatorLine("en"));
  });

  it("omits the registration sentence until a number is configured", () => {
    const { getRegistrationLine } = loadModule();
    expect(getRegistrationLine()).toBe("");
  });

  it("does not emit a placeholder for a missing address", () => {
    const { getBusinessAddressLine } = loadModule();
    const line = getBusinessAddressLine();

    expect(line).toBe("");
    expect(line).not.toMatch(/INSERT/i);
    expect(line).not.toMatch(/TBD|TODO|XXX/i);
  });

  it("renders the registration sentence once the number exists", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER = "TEST-123456";
    const { getRegistrationLine } = loadModule();

    expect(getRegistrationLine()).toBe(
      "Registered business name: NK Platform Studio (TEST-123456), Ireland."
    );
  });

  it("localises the registration and address sentences", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER = "TEST-123456";
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "Una dirección";
    const { getRegistrationLine, getBusinessAddressLine } = loadModule();

    expect(getRegistrationLine("es")).toBe(
      "Nombre comercial registrado: NK Platform Studio (TEST-123456), Irlanda."
    );
    expect(getBusinessAddressLine("es")).toBe(
      "Dirección de la empresa: Una dirección"
    );
  });

  it("still omits a Spanish address sentence when nothing is configured", () => {
    const { getBusinessAddressLine, getRegistrationLine } = loadModule();
    expect(getBusinessAddressLine("es")).toBe("");
    expect(getRegistrationLine("es")).toBe("");
  });
});

describe("public vs server split", () => {
  beforeEach(() => {
    clearLegalEnv();
  });

  it("keeps tax identifiers out of the public entity", () => {
    process.env.LEGAL_VAT_NUMBER = "IE1234567AB";
    process.env.LEGAL_TAX_REFERENCE_NUMBER = "9876543T";
    const { getPublicLegalEntity } = loadModule();

    const serialized = JSON.stringify(getPublicLegalEntity());
    expect(serialized).not.toContain("IE1234567AB");
    expect(serialized).not.toContain("9876543T");
    expect(getPublicLegalEntity().vatNumber).toBeUndefined();
    expect(getPublicLegalEntity().taxReferenceNumber).toBeUndefined();
  });

  it("exposes tax identifiers only on the server entity", () => {
    process.env.LEGAL_VAT_NUMBER = "IE1234567AB";
    const { getServerLegalEntity } = loadModule();

    expect(getServerLegalEntity().vatNumber).toBe("IE1234567AB");
  });
});

describe("legal configuration status", () => {
  beforeEach(() => {
    clearLegalEnv();
  });

  it("reports the missing address as a blocking issue", () => {
    const { getLegalConfigStatus } = loadModule();
    const status = getLegalConfigStatus();

    expect(status.ok).toBe(false);
    expect(status.hasBlockingIssues).toBe(true);
    expect(status.missingRequired).toContain("businessAddress");
  });

  it("treats the business name number as recommended, not blocking", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "Some configured address";
    const { getLegalConfigStatus } = loadModule();
    const status = getLegalConfigStatus();

    expect(status.hasBlockingIssues).toBe(false);
    expect(status.missingRecommended).toContain("businessNameNumber");
  });

  it("clears once every published value is configured", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "Some configured address";
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER = "TEST-123456";
    const { getLegalConfigStatus, getLegalConfigWarning } = loadModule();

    expect(getLegalConfigStatus().ok).toBe(true);
    expect(getLegalConfigWarning()).toBe("");
  });

  it("produces a warning string for superadmin only", () => {
    const { getLegalConfigWarning } = loadModule();
    const warning = getLegalConfigWarning();

    expect(warning).toContain("Legal configuration incomplete");
    expect(warning).toContain("businessAddress");
  });
});
