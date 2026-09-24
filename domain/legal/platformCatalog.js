/**
 * The six Rovaro platform documents. Supplier rental terms are company-owned
 * and are not part of this catalogue.
 */

import {
  LEGAL_DOCUMENT_TYPE,
  MASTER_AGREEMENT_PACKAGE,
} from "./documentTypes";

export const PLATFORM_AUDIENCE = Object.freeze({
  CUSTOMER: "customer",
  SUPPLIER: "supplier",
});

export const PLATFORM_DOCUMENT_CATALOG = Object.freeze([
  {
    documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
    name: "Rovaro Customer Booking Terms",
    audience: PLATFORM_AUDIENCE.CUSTOMER,
    publicPath: "/terms",
    livePath: "/terms",
  },
  {
    documentType: LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY,
    name: "Privacy Policy",
    audience: PLATFORM_AUDIENCE.CUSTOMER,
    publicPath: "/privacy-policy",
    livePath: "/privacy-policy",
  },
  {
    documentType: LEGAL_DOCUMENT_TYPE.COOKIE_POLICY,
    name: "Cookie Policy",
    audience: PLATFORM_AUDIENCE.CUSTOMER,
    publicPath: "/cookie-policy",
    livePath: "/cookie-policy",
  },
  {
    documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
    name: "Partner Agreement",
    audience: PLATFORM_AUDIENCE.SUPPLIER,
    publicPath: "/partner-agreement",
    livePath: "/partner-agreement",
  },
  {
    documentType: LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES,
    name: "Partner Operating Rules",
    audience: PLATFORM_AUDIENCE.SUPPLIER,
    publicPath: "/partner-operating-rules",
    livePath: "/partner-operating-rules",
  },
  {
    documentType: LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE,
    name: "Data Protection Schedule",
    audience: PLATFORM_AUDIENCE.SUPPLIER,
    publicPath: "/data-protection-schedule",
    livePath: "/data-protection-schedule",
  },
]);

export const SUPPLIER_RENTAL_TERMS_NAME = "Supplier Rental Terms";

export function isPlatformDocumentType(documentType) {
  return PLATFORM_DOCUMENT_CATALOG.some((row) => row.documentType === documentType);
}

export function platformDocumentMeta(documentType) {
  return (
    PLATFORM_DOCUMENT_CATALOG.find((row) => row.documentType === documentType) ||
    null
  );
}

export function customerFacingDocuments() {
  return PLATFORM_DOCUMENT_CATALOG.filter(
    (row) => row.audience === PLATFORM_AUDIENCE.CUSTOMER
  );
}

export function supplierPackageDocuments() {
  return PLATFORM_DOCUMENT_CATALOG.filter((row) =>
    MASTER_AGREEMENT_PACKAGE.includes(row.documentType)
  );
}

/** Customer footer lists customer documents only. */
export function customerFooterDocuments() {
  return customerFacingDocuments();
}
