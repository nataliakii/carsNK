/**
 * @jest-environment node
 */

import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import {
  PLATFORM_DOCUMENT_CATALOG,
  PLATFORM_AUDIENCE,
  customerFooterDocuments,
  isPlatformDocumentType,
} from "@/domain/legal/platformCatalog";
import {
  TRANSLATION_STATUS,
  assessTranslationCompleteness,
  createTranslationDraft,
  regenerateChangedSections,
  assertTranslationPublishable,
  translationStatusFor,
  visibleToAudience,
} from "@/domain/legal/translationWorkflow";
import {
  PUBLICATION_CHANGE,
  legalReacceptanceTask,
  reacceptanceRequired,
} from "@/domain/legal/publicationClass";
import {
  BOOKING_FEE_TABLE_LOCALES,
  renderBookingFeeTable,
} from "@/domain/legal/bookingFeeOutcomes";
import { evaluateVehicleChange } from "@/domain/legal/vehicleCommitment";
import { legalDocumentLayout, sanitizeLegalHtml, auditLegalAction, importPdfUpload } from "@/domain/legal/contentSanitizer";
import {
  SUPPLIER_REQUIREMENTS_NOTICE,
  assertCompanyDocumentIsolation,
  customerSupplierTermsOffer,
  publishSupplierTerms,
  removeSupplierTerms,
  replacementLeavesPastBooking,
  saveSupplierTermsDraft,
  validateSupplierRequirementsCopy,
  bookingSupplierSnapshot,
} from "@/domain/legal/supplierTermsVersion";
import {
  buildBookingLegalSnapshot,
  newVersionDoesNotAlterBooking,
} from "@/domain/legal/bookingLegalSnapshot";
import {
  evaluateBookingTermsAcceptance,
  buildTermsAcceptanceRecord,
  BOOKING_TERMS_ERROR,
} from "@/domain/orders/bookingTermsAcceptance";
import { CLICKWRAP_ACCEPTANCE_STATEMENT } from "@/domain/legal/agreementService";
import { superadminMayAcceptTerms } from "@/domain/legal/companyLegalPage";
import { ROLE } from "@models/user";

const source = {
  checksum: "abc",
  version: 2,
  content: {
    title: "Terms",
    sections: [
      { id: "1", heading: "Parties", body: "The Supplier must provide the confirmed vehicle to the Customer." },
      { id: "2", heading: "Fee", body: "The Rovaro Booking Fee is retained by Rovaro except where applicable law requires a refund." },
    ],
  },
};

describe("platform legal document system", () => {
  it("lists six platform documents with customer and supplier audiences", () => {
    expect(PLATFORM_DOCUMENT_CATALOG).toHaveLength(6);
    expect(PLATFORM_DOCUMENT_CATALOG.map((row) => row.documentType)).toEqual([
      LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
      LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY,
      LEGAL_DOCUMENT_TYPE.COOKIE_POLICY,
      LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
      LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES,
      LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE,
    ]);
    expect(
      PLATFORM_DOCUMENT_CATALOG.filter((row) => row.audience === PLATFORM_AUDIENCE.CUSTOMER)
    ).toHaveLength(3);
    expect(
      PLATFORM_DOCUMENT_CATALOG.filter((row) => row.audience === PLATFORM_AUDIENCE.SUPPLIER)
    ).toHaveLength(3);
    expect(isPlatformDocumentType("supplier-rental-terms")).toBe(false);
    expect(customerFooterDocuments().map((row) => row.documentType)).not.toContain(
      LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT
    );
  });

  it("accepts the supplier package with one statement and blocks superadmin acceptance", () => {
    expect(CLICKWRAP_ACCEPTANCE_STATEMENT).toMatch(/Partner Agreement/);
    expect(CLICKWRAP_ACCEPTANCE_STATEMENT).toMatch(/Partner Operating Rules/);
    expect(CLICKWRAP_ACCEPTANCE_STATEMENT).toMatch(/Data Protection Schedule/);
    expect(superadminMayAcceptTerms(ROLE.SUPERADMIN)).toBe(false);
    expect(superadminMayAcceptTerms(ROLE.ADMIN)).toBe(true);
  });

  it("requires separate Rovaro and supplier acceptance, and skips the supplier box when standard terms apply", () => {
    const platform = { available: true, checksum: "p1", version: 3, documentType: "customer-booking-terms", language: "en" };
    const company = { available: true, sourceHash: "c1", language: "es" };
    expect(
      evaluateBookingTermsAcceptance({
        platform,
        company,
        payload: { platform: { accepted: true, checksum: "p1" } },
      }).code
    ).toBe(BOOKING_TERMS_ERROR.COMPANY_REQUIRED);
    expect(
      evaluateBookingTermsAcceptance({
        platform,
        company: { available: false },
        payload: { platform: { accepted: true, checksum: "p1" } },
      }).ok
    ).toBe(true);

    const record = buildTermsAcceptanceRecord({
      platform,
      company,
      privacy: { version: 4, checksum: "priv", language: "en" },
      payload: {
        platform: { accepted: true, checksum: "p1" },
        company: { accepted: true, sourceHash: "c1" },
      },
    });
    expect(record.platform.accepted).toBe(true);
    expect(record.company.accepted).toBe(true);
    expect(record.privacy.contractualCheckbox).toBe(false);
    expect(record.privacy.version).toBe(4);
    expect(record.cookies).toBeUndefined();
  });

  it("keeps booking snapshots immutable when a newer version is published", () => {
    const snapshot = buildBookingLegalSnapshot({
      platform: { version: 1, checksum: "old", language: "en" },
      privacy: { version: 1, checksum: "p", language: "en" },
      supplierTerms: { documentId: "supplier-terms-1", version: 2, language: "en", checksum: "s2" },
      language: "en",
      priceMinor: 10000,
      bookingFeeMinor: 1000,
      bookingFeePercent: 10,
      supplierBalanceMinor: 9000,
      carId: "car-1",
    });
    const next = newVersionDoesNotAlterBooking(snapshot, { version: 2, checksum: "new" });
    expect(next.altered).toBe(false);
    expect(next.booking.customerBookingTerms.version).toBe(1);
    expect(next.booking.supplierRentalTerms.checksum).toBe("s2");
    expect(snapshot.fullDocumentCopies).toBe(false);
  });

  it("distinguishes editorial and material updates as one supplier task", () => {
    expect(
      reacceptanceRequired({
        documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
        changeClass: PUBLICATION_CHANGE.EDITORIAL,
      })
    ).toBe(false);
    expect(
      reacceptanceRequired({
        documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
        changeClass: PUBLICATION_CHANGE.MATERIAL,
      })
    ).toBe(true);
    const tasks = legalReacceptanceTask([
      { documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT, changeClass: PUBLICATION_CHANGE.MATERIAL },
      { documentType: LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES, changeClass: PUBLICATION_CHANGE.MATERIAL },
      { documentType: LEGAL_DOCUMENT_TYPE.COOKIE_POLICY, changeClass: PUBLICATION_CHANGE.MATERIAL },
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].documentTypes).toHaveLength(2);
  });

  it("renders the complete booking-fee table in EN, ES, RU and UK", () => {
    for (const lang of BOOKING_FEE_TABLE_LOCALES) {
      const table = renderBookingFeeTable(lang);
      expect(table.rows).toHaveLength(7);
      expect(table.columns).toHaveLength(3);
      expect(table.title.length).toBeGreaterThan(10);
      expect(table.footnote.length).toBeGreaterThan(20);
      expect(table.rows[3].bookingFee.toLowerCase()).toMatch(/full|completo|полный|повне/);
    }
    expect(renderBookingFeeTable("en").title).toBe("What happens to the Rovaro Booking Fee?");
    expect(renderBookingFeeTable("uk").title).toMatch(/комісією/);
  });

  it("refuses shortened translations and never auto-publishes a draft", () => {
    const draft = createTranslationDraft({
      source,
      language: "es",
      translateSection: (section) => ({
        heading: section.heading,
        body: section.body + " traducción completa",
      }),
    });
    expect(draft.status).toBe(TRANSLATION_STATUS.DRAFT);
    expect(draft.published).toBe(false);
    expect(assertTranslationPublishable(source, { ...draft, autoPublished: true }).code).toBe(
      "auto_publish_forbidden"
    );
    const short = {
      sourceChecksum: "abc",
      sections: [
        { id: "1", heading: "Partes", body: "Corto" },
        { id: "2", heading: "Tarifa", body: source.content.sections[1].body + " completo" },
      ],
    };
    expect(assessTranslationCompleteness(source, short).shortened).toContain("1");
    expect(assertTranslationPublishable(source, short).ok).toBe(false);
    expect(visibleToAudience({ status: "draft" })).toBe(false);
    expect(visibleToAudience({ status: "published" })).toBe(true);
  });

  it("marks a translation outdated when the source checksum changes and regenerates only that section", () => {
    const draft = createTranslationDraft({
      source,
      language: "ru",
      translateSection: (section) => ({ heading: section.heading, body: section.body + " перевод" }),
    });
    expect(
      translationStatusFor({ translation: draft, sourceChecksum: "changed" })
    ).toBe(TRANSLATION_STATUS.OUTDATED);
    const nextSource = {
      ...source,
      checksum: "changed",
      content: {
        sections: [
          { ...source.content.sections[0], body: source.content.sections[0].body + " Updated sentence." },
          source.content.sections[1],
        ],
      },
    };
    const regenerated = regenerateChangedSections({
      source: nextSource,
      translation: draft,
      language: "ru",
      translateSection: (section) => ({ heading: section.heading, body: section.body + " новый" }),
    });
    expect(regenerated.regeneratedSectionIds).toEqual(["1"]);
    expect(regenerated.published).toBe(false);
  });

  it("isolates company documents and keeps supplier requirements lawful", () => {
    expect(
      assertCompanyDocumentIsolation({
        actorCompanyId: "a",
        requestedCompanyId: "b",
      }).ok
    ).toBe(false);
    expect(
      assertCompanyDocumentIsolation({
        actorCompanyId: "a",
        requestedCompanyId: "b",
        isSuperadmin: true,
      }).companyId
    ).toBe("b");
    expect(validateSupplierRequirementsCopy("Spanish law requires a minimum driver age of 23").ok).toBe(
      false
    );
    expect(SUPPLIER_REQUIREMENTS_NOTICE).toMatch(/minimum age/);
  });

  it("versions supplier terms without rewriting an accepted booking", () => {
    const draft = saveSupplierTermsDraft({
      companyId: "co-1",
      title: "Rental Terms",
      body: "Minimum driver age is 21. Deposit is disclosed before payment.",
    });
    const published = publishSupplierTerms(draft.record);
    const accepted = bookingSupplierSnapshot(published.record);
    const replacement = saveSupplierTermsDraft({
      current: published.record,
      companyId: "co-1",
      title: "Rental Terms",
      body: "Minimum driver age is 25. Deposit is disclosed before payment. Extra rule.",
    });
    const republished = publishSupplierTerms(replacement.record);
    const past = replacementLeavesPastBooking(accepted, republished.record);
    expect(past.stored.version).toBe(accepted.version);
    expect(past.current.version).not.toBe(accepted.version);
    expect(customerSupplierTermsOffer(removeSupplierTerms(republished.record), "Cars").showCheckbox).toBe(
      false
    );
    expect(customerSupplierTermsOffer(removeSupplierTerms(republished.record), "Cars").blocksBooking).toBe(
      false
    );
  });

  it("refunds the booking fee when a supplier change is rejected and does not charge the full rental price", () => {
    const rejected = evaluateVehicleChange({
      originalClass: "compact",
      offeredClass: "standard",
      originalPriceMinor: 10000,
      offeredPriceMinor: 10000,
      customerAccepted: false,
    });
    expect(rejected.bookingFeeRefund).toBe("full");
    expect(rejected.automaticFullRentalPenalty).toBe(false);
    expect(rejected.supplierReimbursesBookingFee).toBe(true);

    const agreed = evaluateVehicleChange({
      originalClass: "compact",
      offeredClass: "standard",
      originalPriceMinor: 10000,
      offeredPriceMinor: 10000,
      customerAccepted: true,
    });
    expect(agreed.allowed).toBe(true);

    const priceUp = evaluateVehicleChange({
      originalClass: "compact",
      offeredClass: "compact",
      originalPriceMinor: 10000,
      offeredPriceMinor: 12000,
      customerAccepted: true,
    });
    expect(priceUp.allowed).toBe(false);
    expect(priceUp.automaticFullRentalPenalty).toBe(false);
  });

  it("sanitizes imports and lays out desktop and mobile documents", () => {
    const clean = sanitizeLegalHtml('<p onclick="alert(1)">Hi</p><script>bad()</script>');
    expect(clean).not.toMatch(/script|onclick/);
    expect(importPdfUpload({ filename: "terms.pdf", bytesLength: 10 }).editable).toBe(false);
    expect(legalDocumentLayout("mobile").tableDisplay).toBe("stacked");
    expect(legalDocumentLayout("desktop").maxWidth).toBeGreaterThan(legalDocumentLayout("mobile").maxWidth);
    expect(auditLegalAction("publish", { checksum: "abc", html: "<p>secret</p>", storageUrl: "s3://x" })).toEqual({
      action: "publish",
      checksum: "abc",
    });
  });
});
