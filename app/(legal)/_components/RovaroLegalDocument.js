import {
  getPublishedDocument,
  resolveDocumentForDisplay,
} from "@/domain/legal/documentService";
import { renderLegalDocument } from "@/domain/legal/tokens";
import {
  markdownInlineToHtml,
  markdownToHtml,
} from "@/domain/legal/documentMarkup";
import { loadLegalSettingsWithTokens } from "@/domain/legal/legalSettingsService";
import { platformDocumentDisplayName } from "@/domain/legal/platformPublish";
import { PUBLIC_LEGAL_STATUS_PREPARING } from "@/domain/legal/publicLegalPageLayout";
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
 *
 * Optional `children` (e.g. BookingFeeOutcomesTable) render only when a
 * published document loaded successfully — never with unpublished/error states.
 */

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
  const message =
    documentType === "customer-booking-terms"
      ? "Rovaro Customer Booking Terms are being prepared."
      : `${name} is being prepared.`;
  return (
    <div
      data-testid="public-legal-unpublished"
      style={PUBLIC_LEGAL_STATUS_PREPARING}
    >
      {message}
    </div>
  );
}

function DocumentHeader({ title, version, effectiveFrom, publishedAt, source, fellBackToEnglish }) {
  return (
    <header data-testid="public-legal-document-header">
      <h1
        style={{
          textAlign: "center",
          marginTop: 0,
          marginBottom: 12,
          fontSize: 28,
          fontWeight: 600,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          textAlign: "center",
          color: "#78909c",
          fontSize: 13,
          marginBottom: 32,
        }}
      >
        {publishedAt ? `Published ${publishedAt}` : effectiveFrom ? `Published ${effectiveFrom}` : ""}
        {source === "draft" ? " · Draft — not yet published" : ""}
        {fellBackToEnglish ? " · English version shown" : ""}
      </p>
    </header>
  );
}

export default async function RovaroLegalDocument({
  documentType,
  locale,
  publishedOnly = false,
  children = null,
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
        <div style={PUBLIC_LEGAL_STATUS_PREPARING}>
          This document is not available yet.
        </div>
      );
    }

    const rendered = renderLegalDocument(doc, { settings: tokens });
    const effectiveFrom = formatDate(doc.effectiveFrom);
    const publishedAt = formatDate(doc.publishedAt);

    return (
      <>
        <article data-testid="public-legal-published">
          <DocumentHeader
            title={rendered.title}
            version={doc.version}
            effectiveFrom={effectiveFrom}
            publishedAt={publishedAt}
            source={source}
            fellBackToEnglish={fellBackToEnglish}
          />

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
                  dangerouslySetInnerHTML={{
                    __html: markdownInlineToHtml(section.heading),
                  }}
                />
              ) : null}
              {section.text ? (
                <div
                  style={{
                    lineHeight: 1.7,
                    color: "#37474f",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(section.text),
                  }}
                />
              ) : null}
            </section>
          ))}
        </article>
        {children}
      </>
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
