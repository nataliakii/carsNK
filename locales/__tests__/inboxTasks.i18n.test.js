import el from "@/locales/el.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import ru from "@/locales/ru.json";

import { buildCompanySetupTasks } from "@/domain/legal/companySetupTasks";

const LOCALES = { en, es, el, ru };

/** Every actionable category, so no task id can ship without copy. */
const ALL_TASKS = [
  ...buildCompanySetupTasks({
    verificationStatus: "VERIFIED",
    termsPublication: "READY_TO_ACCEPT",
  }),
  ...buildCompanySetupTasks({
    verificationStatus: "VERIFIED",
    termsPublication: "UPDATE_REQUIRED",
  }),
  ...buildCompanySetupTasks({
    verificationStatus: "VERIFIED",
    termsPublication: "READY_TO_ACCEPT",
    hasCustomAgreement: true,
  }),
  ...buildCompanySetupTasks({
    verificationStatus: "REJECTED",
    documents: [{ label: "Insurance", accepted: false, reviewedAt: "2026-09-01" }],
  }),
];

function lookup(tree, key) {
  return key.split(".").reduce((node, part) => node?.[part], tree);
}

describe("inbox task i18n", () => {
  it("covers every task id in en, es, el and ru", () => {
    expect(ALL_TASKS.map((task) => task.id).sort()).toEqual([
      "COMPANY_CHANGES_REQUESTED",
      "CUSTOM_AGREEMENT_READY",
      "DOCUMENT_CHANGES_REQUESTED",
      "TERMS_READY_TO_ACCEPT",
      "TERMS_UPDATE_REQUIRED",
    ]);
    for (const tree of Object.values(LOCALES)) {
      for (const task of ALL_TASKS) {
        expect(lookup(tree, task.titleKey)).toBeTruthy();
        expect(lookup(tree, task.descriptionKey)).toBeTruthy();
      }
    }
  });

  it("covers the bell group labels in en, es, el and ru", () => {
    for (const tree of Object.values(LOCALES)) {
      expect(tree.inbox.bookings).toBeTruthy();
      expect(tree.inbox.companySetup).toBeTruthy();
      expect(tree.inbox.bookingsNeedAttention).toContain("{{count}}");
    }
  });

  it("keeps the document placeholder in every locale", () => {
    for (const tree of Object.values(LOCALES)) {
      expect(
        tree.inbox.tasks.DOCUMENT_CHANGES_REQUESTED.description
      ).toContain("{{names}}");
    }
  });
});
