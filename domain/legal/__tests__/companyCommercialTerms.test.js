/**
 * Can a legal document compute the commission from a token?
 *
 * Yes, with one boundary. Substitution happens at render time and the document
 * checksum is computed over the unsubstituted template, so a token does not by
 * itself break auditability — what each party agreed to is reconstructable as
 * long as the resolved value is frozen at the moment of acceptance.
 *
 * The boundary is the SHARED package. Its `packageChecksum` decides whether a
 * partner's acceptance is still current; an out-of-date acceptance hides the
 * partner's fleet and cancels open checkouts. So the shared documents that
 * every partner signs identically must not resolve one partner's percentage,
 * and these tests hold that line.
 */

import {
  COMMERCIAL_TERMS_VERSION,
  buildCompanyCommercialTokens,
  companyCommercialRequirables,
  freezeCompanyCommercialTerms,
  resolveCompanyCommercialTerms,
  verifyCompanyCommercialTerms,
} from "@/domain/legal/companyCommercialTerms";
import { MarketplaceBookingFeeError } from "@/domain/orders/marketplaceBookingFee";
import { computeDocumentChecksum } from "@/domain/legal/checksum";
import {
  buildTokenValues,
  renderLegalDocument,
} from "@/domain/legal/tokens";
import { getSeedDocuments } from "@/domain/legal/documentRegistry";
import {
  buildLegalSettingsTokens,
  resolveLegalSettings,
} from "@/domain/legal/legalSettings";

const DEFAULT_COMPANY = { marketplaceBookingFeeBps: null };
const NEGOTIATED_COMPANY = { marketplaceBookingFeeBps: 3000 };

function annexDocument() {
  return {
    platform: "rovaro",
    documentType: "partner-agreement",
    language: "en",
    jurisdiction: "ES",
    version: 1,
    content: {
      title: "Commercial terms annex",
      sections: [
        {
          id: "rate",
          heading: "Rovaro Booking Fee",
          body: "The Operator retains {{company.bookingFeePercent}} of the total rental price. The Supplier collects the remaining {{company.supplierBalancePercent}} directly from the Customer.",
          requires: ["bookingFeePercent"],
        },
      ],
    },
  };
}

describe("the rate a legal document would quote comes from the canonical resolver", () => {
  test("a company on the default resolves to 10% / 90%", () => {
    const terms = resolveCompanyCommercialTerms({ company: DEFAULT_COMPANY });
    expect(terms.version).toBe(COMMERCIAL_TERMS_VERSION);
    expect(terms.bookingFeePercentLabel).toBe("10");
    expect(terms.supplierBalancePercentLabel).toBe("90");
    expect(terms.isPlatformDefault).toBe(true);
    expect(terms.isNegotiated).toBe(false);
  });

  test("a company negotiated at 30% resolves to 30% / 70%", () => {
    const terms = resolveCompanyCommercialTerms({
      company: NEGOTIATED_COMPANY,
    });
    expect(terms.bookingFeePercentLabel).toBe("30");
    expect(terms.supplierBalancePercentLabel).toBe("70");
    expect(terms.isNegotiated).toBe(true);
    expect(buildCompanyCommercialTokens(terms)).toEqual({
      "company.bookingFeePercent": "30%",
      "company.supplierBalancePercent": "70%",
    });
  });

  test("an unusable stored rate yields no token at all", () => {
    const terms = resolveCompanyCommercialTerms({
      company: { marketplaceBookingFeeBps: "thirty" },
    });
    expect(terms.rateSource).toBe("invalid");
    expect(terms.error).toBeTruthy();
    expect(buildCompanyCommercialTokens(terms)).toEqual({});
    expect(companyCommercialRequirables(terms).bookingFeePercent).toBe("");
  });
});

describe("a token renders the negotiated rate into the per-company annex", () => {
  test("30% is substituted and the section is kept", () => {
    const rendered = renderLegalDocument(annexDocument(), {
      settings: {},
      commercialTerms: resolveCompanyCommercialTerms({
        company: NEGOTIATED_COMPANY,
      }),
    });
    expect(rendered.sections).toHaveLength(1);
    expect(rendered.sections[0].text).toContain("retains 30% of the total");
    expect(rendered.sections[0].text).toContain("remaining 70% directly");
    expect(rendered.sections[0].text).not.toContain("{{");
  });

  test("the template checksum does not change with the rate", () => {
    const doc = annexDocument();
    const before = computeDocumentChecksum(doc);
    renderLegalDocument(doc, {
      settings: {},
      commercialTerms: resolveCompanyCommercialTerms({
        company: NEGOTIATED_COMPANY,
      }),
    });
    expect(computeDocumentChecksum(doc)).toBe(before);
    // 10% and 30% are the same stored text, so the same checksum.
    expect(computeDocumentChecksum(annexDocument())).toBe(before);
  });

  test("without a company the rate-dependent section is dropped, not blanked", () => {
    const rendered = renderLegalDocument(annexDocument(), { settings: {} });
    expect(rendered.sections).toHaveLength(0);
    expect(buildTokenValues({ settings: {} })).not.toHaveProperty(
      "company.bookingFeePercent"
    );
  });
});

describe("the shared documents every partner signs carry no percentage", () => {
  const settings = buildLegalSettingsTokens(resolveLegalSettings(null), {
    language: "en",
  });

  test("no shipped document body uses a company-scoped token", () => {
    const offenders = [];
    for (const doc of getSeedDocuments()) {
      for (const section of doc.content.sections) {
        if (/\{\{\s*company\./.test(`${section.heading}${section.body}`)) {
          offenders.push(`${doc.documentType}/${doc.language}/${section.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("rendering is byte-identical for a 10% and a 30% partner", () => {
    for (const doc of getSeedDocuments()) {
      const asDefault = renderLegalDocument(doc, {
        settings,
        commercialTerms: resolveCompanyCommercialTerms({
          company: DEFAULT_COMPANY,
        }),
      });
      const asNegotiated = renderLegalDocument(doc, {
        settings,
        commercialTerms: resolveCompanyCommercialTerms({
          company: NEGOTIATED_COMPANY,
        }),
      });
      expect(asNegotiated).toEqual(asDefault);
    }
  });
});

describe("the resolved rate is frozen into the acceptance", () => {
  test("a 30% partner freezes 30% with its own checksum", () => {
    const frozen = freezeCompanyCommercialTerms({
      company: NEGOTIATED_COMPANY,
      resolvedAt: new Date("2026-09-25T12:00:00.000Z"),
    });
    expect(frozen.bookingFeeBps).toBe(3000);
    expect(frozen.bookingFeePercentLabel).toBe("30");
    expect(frozen.supplierBalancePercentLabel).toBe("70");
    expect(frozen.rateSource).toBe("override");
    expect(frozen.resolvedAt).toBe("2026-09-25T12:00:00.000Z");
    expect(frozen.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCompanyCommercialTerms(frozen).ok).toBe(true);
  });

  test("the frozen record survives a later change to the company rate", () => {
    const company = { marketplaceBookingFeeBps: 1100 };
    const frozen = freezeCompanyCommercialTerms({ company });
    company.marketplaceBookingFeeBps = 1000;
    expect(frozen.bookingFeeBps).toBe(1100);
    expect(frozen.bookingFeePercentLabel).toBe("11");
    expect(verifyCompanyCommercialTerms(frozen).ok).toBe(true);
  });

  test("an edited snapshot no longer verifies", () => {
    const frozen = freezeCompanyCommercialTerms({
      company: NEGOTIATED_COMPANY,
    });
    const tampered = { ...frozen, bookingFeeBps: 1000 };
    expect(verifyCompanyCommercialTerms(tampered).ok).toBe(false);
  });

  test("signing is blocked rather than recording an unusable rate", () => {
    expect(() =>
      freezeCompanyCommercialTerms({
        company: { marketplaceBookingFeeBps: 9999999 },
      })
    ).toThrow(MarketplaceBookingFeeError);
  });

  test("a platform-default partner freezes the resolved number, not a pointer", () => {
    const frozen = freezeCompanyCommercialTerms({
      company: DEFAULT_COMPANY,
      platformSettings: { marketplaceBookingFeeBps: 1200 },
    });
    expect(frozen.bookingFeeBps).toBe(1200);
    expect(frozen.rateSource).toBe("platform");
  });

  test("the stored snapshot cannot be edited after signing", async () => {
    const { MUTABLE_AFTER_SIGNING, assertOnlyLifecycleFields } = await import(
      "@models/PartnerAgreementAcceptance"
    );
    expect(MUTABLE_AFTER_SIGNING.has("commercialTermsSnapshot")).toBe(false);
    expect(MUTABLE_AFTER_SIGNING.has("templateChecksum")).toBe(false);
    expect(() =>
      assertOnlyLifecycleFields({ $set: { commercialTermsSnapshot: {} } })
    ).toThrow(/immutable/i);
  });
});
