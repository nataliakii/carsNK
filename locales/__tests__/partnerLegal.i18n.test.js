import {
  partnerLegalDe,
  partnerLegalEl,
  partnerLegalEn,
  partnerLegalEs,
  partnerLegalRu,
  partnerLegalUk,
  PARTNER_LEGAL_NAV,
} from "@/locales/partnerLegal";
import { PARTNER_GATE_BLOCKER } from "@/domain/legal/partnerGate";
import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";
import { PARTNER_DOCUMENT_KIND } from "@/domain/legal/partnerDocuments";
import {
  PARTNER_PROFILE_CONFIRMATIONS,
  PARTNER_PROFILE_SECTIONS,
  PARTNER_PROFILE_TEXT_FIELDS,
} from "@/app/admin/legal-profile/_components/partnerLegalFields";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") return flatten(value, path);
    return [path];
  });
}

describe("partner legal i18n", () => {
  it("ships a complete Spanish tree that matches English", () => {
    expect(flatten(partnerLegalEs).sort()).toEqual(flatten(partnerLegalEn).sort());
  });

  it("keeps the same keys on ru, uk, el and de", () => {
    const en = flatten(partnerLegalEn).sort();
    expect(flatten(partnerLegalRu).sort()).toEqual(en);
    expect(flatten(partnerLegalUk).sort()).toEqual(en);
    expect(flatten(partnerLegalEl).sort()).toEqual(en);
    expect(flatten(partnerLegalDe).sort()).toEqual(en);
  });

  it("covers every form field, confirmation, document kind, status and gate blocker", () => {
    for (const section of PARTNER_PROFILE_SECTIONS) {
      expect(partnerLegalEn.form.sections[section.id]).toBeTruthy();
    }
    for (const key of PARTNER_PROFILE_TEXT_FIELDS) {
      expect(partnerLegalEn.form.fields[key].label).toBeTruthy();
    }
    for (const key of PARTNER_PROFILE_CONFIRMATIONS) {
      expect(partnerLegalEn.form.confirmations[key].label).toBeTruthy();
      expect(partnerLegalEn.form.confirmations[key].short).toBeTruthy();
    }
    for (const kind of Object.values(PARTNER_DOCUMENT_KIND)) {
      expect(partnerLegalEn.documents.kinds[kind]).toBeTruthy();
    }
    for (const status of Object.values(PARTNER_VERIFICATION_STATUS)) {
      expect(partnerLegalEn.status[status].label).toBeTruthy();
    }
    for (const code of Object.values(PARTNER_GATE_BLOCKER)) {
      expect(partnerLegalEn.gate.blocker[code]).toBeTruthy();
    }
  });

  it("does not invent legal placeholders", () => {
    const blob = JSON.stringify({
      en: partnerLegalEn,
      es: partnerLegalEs,
      nav: PARTNER_LEGAL_NAV,
    });
    expect(blob).not.toMatch(/\[INSERT/i);
  });

  it("names the nav item in every required locale", () => {
    expect(PARTNER_LEGAL_NAV).toEqual(
      expect.objectContaining({
        en: expect.any(String),
        es: expect.any(String),
        ru: expect.any(String),
        uk: expect.any(String),
        el: expect.any(String),
        de: expect.any(String),
      })
    );
  });
});
