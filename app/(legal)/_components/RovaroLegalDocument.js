import {
  getPublishedDocument,
  resolveDocumentForDisplay,
} from "@/domain/legal/documentService";
import { renderLegalDocument } from "@/domain/legal/tokens";
import { loadLegalSettingsWithTokens } from "@/domain/legal/legalSettingsService";
import {
  getOperatorLine,
  getBusinessAddressLine,
  getRegistrationLine,
  getPublicLegalEntity,
} from "@config/legalEntity";
import { platformDocumentDisplayName } from "@/domain/legal/platformPublish";
import LegalDocumentRetry from "./LegalDocumentRetry";

/**
 * Server-rendered Rovaro legal document.
 *
 * Unlike `LegalPageContent` (which fetches the shared external legal API used
 * by the older CarsNK policies), this component reads Rovaro's own versioned
 * documents. Rendering on the server keeps unconfigured legal values out of
 * the client bundle entirely: a section that depends on a value nobody has
 * confirmed is dropped before the HTML is produced.
 *
 * `publishedOnly` is for public customer pages (Cookie Policy, Privacy, …):
 * unpublished documents show a preparing message instead of draft text.
 */

const contentPadding = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "24px 20px 48px",
};

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function PreparingMessage({ documentType }) {
  const name = platformDocumentDisplayName(documentType);
  return (
    <div style={contentPadding}>
      <div
        style={{
          padding: 16,
          backgroundColor: "#fff3e0",
          borderRadius: 4,
          color: "#e65100",
        }}
      >
        {name} is being prepared.
      </div>
    </div>
  );
}

export default async function RovaroLegalDocument({
  documentType,
  locale,
  publishedOnly = false,
}) {
  try {
    const [{ doc, source, fellBackToEnglish }, { tokens }] = await Promise.all([
      publishedOnly
        ? getPublishedDocument({ documentType, language: locale }).then(
            ({ doc: published, fellBackToEnglish: fellBack }) => ({
              doc: published,
              source: published ? "published" : "none",
              fellBackToEnglish: fellBack,
            })
          )
        : resolveDocumentForDisplay({ documentType, language: locale }),
      loadLegalSettingsWithTokens({ language: locale }),
    ]);

    if (!doc) {
      if (publishedOnly) {
        return <PreparingMessage documentType={documentType} />;
      }
      return (
        <div style={contentPadding}>
          <div
            style={{
              padding: 16,
              backgroundColor: "#fff3e0",
              borderRadius: 4,
              color: "#e65100",
            }}
          >
            This document is not available yet.
          </div>
        </div>
      );
    }

    const rendered = renderLegalDocument(doc, { settings: tokens });
    // The document's own language drives the operator wording in its footer,
    // which may differ from the route locale when we fall back to English.
    const entity = getPublicLegalEntity(doc.language);
    const addressLine = getBusinessAddressLine(doc.language);
    const registrationLine = getRegistrationLine(doc.language);
    const effectiveFrom = formatDate(doc.effectiveFrom);

    return (
      <article style={contentPadding}>
        <h1
          style={{
            textAlign: "center",
            marginBottom: 12,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {rendered.title}
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#78909c",
            fontSize: 13,
            marginBottom: 32,
          }}
        >
          Version {doc.version}
          {effectiveFrom ? ` · Effective from ${effectiveFrom}` : ""}
          {source === "draft" ? " · Draft — not yet published" : ""}
          {fellBackToEnglish ? " · English version shown" : ""}
        </p>

        {rendered.sections.map((section) => (
          <section key={section.id} style={{ marginBottom: 24 }}>
            {section.heading ? (
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#263238",
                }}
              >
                {section.heading}
              </h2>
            ) : null}
            <div
              style={{
                lineHeight: 1.7,
                whiteSpace: "pre-line",
                color: "#37474f",
              }}
            >
              {section.text}
            </div>
          </section>
        ))}

        <footer
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid #e0e0e0",
            fontSize: 13,
            lineHeight: 1.7,
            color: "#607d8b",
          }}
        >
          <div>{getOperatorLine(doc.language)}</div>
          {registrationLine ? <div>{registrationLine}</div> : null}
          {addressLine ? <div>{addressLine}</div> : null}
          <div>{entity.legalEmail}</div>
        </footer>
      </article>
    );
  } catch (err) {
    console.error(
      "[legal document]",
      documentType,
      locale,
      err?.message || err
    );
    return <LegalDocumentRetry />;
  }
}
