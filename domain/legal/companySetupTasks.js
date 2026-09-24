import { companySetupHref } from "./companySetupReadiness";

const TERMS_HREF = companySetupHref("terms");
const DETAILS_HREF = companySetupHref("details");
const DOCUMENTS_HREF = companySetupHref("documents");

/** Terms can only be accepted by a verified company. */
const TERMS_ACCEPTABLE_STATUSES = new Set(["VERIFIED"]);
/** Statuses in which the documents API accepts a replacement upload. */
const DOCUMENT_UPLOAD_STATUSES = new Set(["DRAFT", "REJECTED", "SUSPENDED"]);

/**
 * One inbox task. `title` / `description` are English fallbacks so the API
 * response stays readable; the UI renders `titleKey` / `descriptionKey`
 * through i18next with those strings as defaultValue.
 */
function task({ id, title, description, href, params }) {
  return {
    id,
    title,
    titleKey: `inbox.tasks.${id}.title`,
    description,
    descriptionKey: `inbox.tasks.${id}.description`,
    ...(params ? { descriptionParams: params } : null),
    href,
  };
}

/**
 * Actionable company-setup tasks. One task per category.
 * Informational states (unpublished terms, under review, verified, listing
 * wait, suspension without an available action) produce nothing.
 */
export function buildCompanySetupTasks({
  verificationStatus = "",
  termsPublication = "NOT_PUBLISHED",
  hasCustomAgreement = false,
  documents = [],
} = {}) {
  const status = String(verificationStatus || "");
  const tasks = [];
  const published =
    TERMS_ACCEPTABLE_STATUSES.has(status) &&
    (termsPublication === "READY_TO_ACCEPT" ||
      termsPublication === "UPDATE_REQUIRED");

  if (published && hasCustomAgreement) {
    tasks.push(
      task({
        id: "CUSTOM_AGREEMENT_READY",
        title: "Review and accept your company agreement",
        description: "Your company agreement is ready to review.",
        href: TERMS_HREF,
      })
    );
  } else if (published && termsPublication === "UPDATE_REQUIRED") {
    tasks.push(
      task({
        id: "TERMS_UPDATE_REQUIRED",
        title: "Accept updated Rovaro Terms",
        description: "Updated terms require your acceptance.",
        href: TERMS_HREF,
      })
    );
  } else if (published) {
    tasks.push(
      task({
        id: "TERMS_READY_TO_ACCEPT",
        title: "Review and accept Rovaro Terms",
        description: "Rovaro Terms are ready for your company.",
        href: TERMS_HREF,
      })
    );
  }

  if (status === "REJECTED") {
    tasks.push(
      task({
        id: "COMPANY_CHANGES_REQUESTED",
        title: "Update company details",
        description: "Rovaro asked you to update your company details.",
        href: DETAILS_HREF,
      })
    );
  }

  const replacements = (documents || []).filter(
    (doc) => doc && doc.accepted === false && doc.reviewedAt && safeDocumentName(doc)
  );
  if (replacements.length && DOCUMENT_UPLOAD_STATUSES.has(status)) {
    const names = replacements.map((doc) => safeDocumentName(doc)).filter(Boolean);
    tasks.push(
      task({
        id: "DOCUMENT_CHANGES_REQUESTED",
        title: "Update company documents",
        description: names.length
          ? `Replace: ${names.join(", ")}.`
          : "Update the company documents Rovaro asked you to replace.",
        href: DOCUMENTS_HREF,
        params: { names: names.join(", ") },
      })
    );
  }

  return tasks;
}

const DOCUMENT_LABELS = {
  company_registration: "Company registration",
  insurance_certificate: "Insurance certificate",
};

function safeDocumentName(doc) {
  const name = String(
    doc.label || DOCUMENT_LABELS[doc.kind] || doc.kind || ""
  ).trim();
  if (!name || name.length > 80) return "";
  if (/checksum|storage|http|review note|ip address/i.test(name)) return "";
  return name;
}

export function companySetupInbox(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  return { count: list.length, tasks: list };
}
