/**
 * Read/write access to platform-scoped legal documents.
 *
 * Every query in this module is filtered by `platform: "rovaro"`. Documents
 * belonging to other projects are out of reach by construction, so nothing
 * here can read, modify or archive them.
 */

import LegalDocument from "@models/LegalDocument";
import { connectToDB } from "@lib/database";

import {
  LEGAL_PLATFORM,
  LEGAL_DOCUMENT_STATUS,
  ALL_LEGAL_DOCUMENT_TYPES,
  LEGAL_AUTHORITATIVE_LANGUAGE,
  LEGAL_LANGUAGES,
  normalizeLegalLanguage,
  normalizeJurisdiction,
} from "./documentTypes";
import { getSeedDocuments, getSeedDocument } from "./documentRegistry";
import { computeDocumentChecksum, verifyDocumentChecksum } from "./checksum";
import { buildDocumentKey } from "./documentKeys";
import { sanitizeLegalHtml } from "./contentSanitizer";
import { buildTranslationDraft } from "./translationAdapter";

/** Scope guard applied to every query. */
function scope(extra = {}) {
  return { platform: LEGAL_PLATFORM, ...extra };
}

/**
 * Insert any built-in document that is not in the store yet, as a draft.
 * Existing rows are left untouched — including their status and checksum.
 *
 * @param {{ byEmail?: string }} [opts]
 */
export async function syncSeedDocuments({ byEmail = "" } = {}) {
  await connectToDB();
  const seeds = getSeedDocuments();
  const created = [];
  const skipped = [];

  for (const seed of seeds) {
    const existing = await LegalDocument.findOne(
      scope({ pk: seed.pk, sk: seed.sk })
    ).lean();
    if (existing) {
      skipped.push({
        documentType: seed.documentType,
        language: seed.language,
        version: seed.version,
        checksumMatches: existing.checksum === seed.checksum,
      });
      continue;
    }
    await LegalDocument.create({
      ...seed,
      history: [
        {
          version: seed.version,
          checksum: seed.checksum,
          status: LEGAL_DOCUMENT_STATUS.DRAFT,
          changedAt: new Date(),
          changedByEmail: byEmail,
          note: "Seeded from built-in content",
        },
      ],
    });
    created.push({
      documentType: seed.documentType,
      language: seed.language,
      version: seed.version,
    });
  }

  return { created, skipped };
}

/**
 * Highest published version of a document.
 * Falls back to the authoritative English version when the requested language
 * has not been published, so a partner never sees an empty page.
 *
 * @param {{ documentType: string, language?: string, jurisdiction?: string }} params
 */
export async function getPublishedDocument({
  documentType,
  language,
  jurisdiction,
}) {
  await connectToDB();
  const lang = normalizeLegalLanguage(language);
  const jur = normalizeJurisdiction(jurisdiction);

  const find = (l) =>
    LegalDocument.findOne(
      scope({
        documentType,
        language: l,
        jurisdiction: jur,
        status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
      })
    )
      .sort({ version: -1 })
      .lean();

  const direct = await find(lang);
  if (direct) return { doc: direct, fellBackToEnglish: false };

  if (lang !== LEGAL_AUTHORITATIVE_LANGUAGE) {
    const english = await find(LEGAL_AUTHORITATIVE_LANGUAGE);
    if (english) return { doc: english, fellBackToEnglish: true };
  }

  return { doc: null, fellBackToEnglish: false };
}

/**
 * Exact version, used when resolving what a partner actually accepted.
 *
 * @param {{ documentType: string, language: string, jurisdiction?: string, version: number }} params
 */
export async function getDocumentVersion({
  documentType,
  language,
  jurisdiction,
  version,
}) {
  await connectToDB();
  const key = buildDocumentKey({
    documentType,
    language,
    jurisdiction,
    version,
  });
  return LegalDocument.findOne(scope(key)).lean();
}

/** Every version of every Rovaro document, newest first. Superadmin view. */
export async function listDocuments() {
  await connectToDB();
  return LegalDocument.find(scope())
    .sort({ documentType: 1, language: 1, version: -1 })
    .lean();
}

/**
 * Publish a specific version and archive the previously published one.
 *
 * @param {{ documentType: string, language: string, jurisdiction?: string,
 *           version: number, effectiveFrom?: Date|string|null, byEmail?: string }} params
 */
export async function publishDocument({
  documentType,
  language,
  jurisdiction,
  version,
  effectiveFrom = null,
  byEmail = "",
}) {
  await connectToDB();
  const jur = normalizeJurisdiction(jurisdiction);
  const lang = normalizeLegalLanguage(language);

  const doc = await LegalDocument.findOne(
    scope({ documentType, language: lang, jurisdiction: jur, version })
  );
  if (!doc) {
    return { ok: false, code: "not_found", message: "Document version not found" };
  }
  if (doc.status === LEGAL_DOCUMENT_STATUS.PUBLISHED) {
    return { ok: true, unchanged: true, doc: doc.toObject() };
  }

  const integrity = verifyDocumentChecksum(doc.toObject(), doc.checksum);
  if (!integrity.ok) {
    return {
      ok: false,
      code: "checksum_mismatch",
      message:
        "Stored content does not match its checksum; refusing to publish a tampered document",
      integrity,
    };
  }

  const now = new Date();

  const currentlyPublished = await LegalDocument.find(
    scope({
      documentType,
      language: lang,
      jurisdiction: jur,
      status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
    })
  );
  for (const previous of currentlyPublished) {
    previous.status = LEGAL_DOCUMENT_STATUS.ARCHIVED;
    previous.archivedAt = now;
    previous.history = [
      ...(previous.history || []),
      {
        version: previous.version,
        checksum: previous.checksum,
        status: LEGAL_DOCUMENT_STATUS.ARCHIVED,
        effectiveFrom: previous.effectiveFrom,
        archivedAt: now,
        changedAt: now,
        changedByEmail: byEmail,
        note: `Superseded by version ${version}`,
      },
    ];
    await previous.save();
  }

  doc.status = LEGAL_DOCUMENT_STATUS.PUBLISHED;
  doc.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : now;
  doc.publishedAt = now;
  doc.publishedByEmail = byEmail;
  doc.history = [
    ...(doc.history || []),
    {
      version: doc.version,
      checksum: doc.checksum,
      status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
      effectiveFrom: doc.effectiveFrom,
      changedAt: now,
      changedByEmail: byEmail,
      note: "Published",
    },
  ];
  await doc.save();

  return { ok: true, unchanged: false, doc: doc.toObject() };
}

/**
 * @param {{ documentType: string, language: string, jurisdiction?: string,
 *           version: number, byEmail?: string, reason?: string }} params
 */
export async function archiveDocument({
  documentType,
  language,
  jurisdiction,
  version,
  byEmail = "",
  reason = "",
}) {
  await connectToDB();
  const doc = await LegalDocument.findOne(
    scope({
      documentType,
      language: normalizeLegalLanguage(language),
      jurisdiction: normalizeJurisdiction(jurisdiction),
      version,
    })
  );
  if (!doc) {
    return { ok: false, code: "not_found", message: "Document version not found" };
  }
  if (doc.status === LEGAL_DOCUMENT_STATUS.ARCHIVED) {
    return { ok: true, unchanged: true, doc: doc.toObject() };
  }

  const now = new Date();
  doc.status = LEGAL_DOCUMENT_STATUS.ARCHIVED;
  doc.archivedAt = now;
  doc.history = [
    ...(doc.history || []),
    {
      version: doc.version,
      checksum: doc.checksum,
      status: LEGAL_DOCUMENT_STATUS.ARCHIVED,
      archivedAt: now,
      changedAt: now,
      changedByEmail: byEmail,
      note: reason || "Archived",
    },
  ];
  await doc.save();
  return { ok: true, unchanged: false, doc: doc.toObject() };
}

/**
 * Create the next version of a document from new content.
 * The existing version is never modified, so an agreement already accepted
 * against it stays resolvable and verifiable.
 *
 * @param {{ documentType: string, language: string, jurisdiction?: string,
 *           content: { title: string, sections: Array<object> },
 *           byEmail?: string, note?: string }} params
 */
export async function createDocumentVersion({
  documentType,
  language,
  jurisdiction,
  content,
  byEmail = "",
  note = "",
}) {
  await connectToDB();
  const lang = normalizeLegalLanguage(language);
  const jur = normalizeJurisdiction(jurisdiction);

  const latest = await LegalDocument.findOne(
    scope({ documentType, language: lang, jurisdiction: jur })
  )
    .sort({ version: -1 })
    .lean();

  const version = (latest?.version || 0) + 1;
  const base = {
    platform: LEGAL_PLATFORM,
    documentType,
    language: lang,
    jurisdiction: jur,
    version,
    status: LEGAL_DOCUMENT_STATUS.DRAFT,
    effectiveFrom: null,
    content: {
      title: sanitizeLegalHtml(content?.title || ""),
      sections: (content?.sections || []).map((section) => ({
        id: String(section.id),
        heading: sanitizeLegalHtml(section.heading || ""),
        body: sanitizeLegalHtml(section.body ?? section.text ?? ""),
        requires: Array.isArray(section.requires) ? section.requires : [],
      })),
    },
  };

  const checksum = computeDocumentChecksum(base);
  const created = await LegalDocument.create({
    ...base,
    checksum,
    ...buildDocumentKey(base),
    history: [
      {
        version,
        checksum,
        status: LEGAL_DOCUMENT_STATUS.DRAFT,
        changedAt: new Date(),
        changedByEmail: byEmail,
        note: note || "New draft version",
      },
    ],
  });

  return { ok: true, doc: created.toObject() };
}

/**
 * Create a translation draft from the latest source-language content.
 * Never publishes. Refuses incomplete auto-generated results on publish
 * via assertTranslationPublishable at the call site.
 */
export async function createTranslationDraftVersion({
  documentType,
  sourceLanguage = LEGAL_AUTHORITATIVE_LANGUAGE,
  language,
  jurisdiction,
  byEmail = "",
  translateSection = null,
}) {
  const sourceLang = normalizeLegalLanguage(sourceLanguage);
  const targetLang = normalizeLegalLanguage(language);
  if (sourceLang === targetLang) {
    return {
      ok: false,
      code: "same_language",
      message: "Source and target language must differ",
    };
  }

  await connectToDB();
  const jur = normalizeJurisdiction(jurisdiction);
  const source =
    (await LegalDocument.findOne(
      scope({
        documentType,
        language: sourceLang,
        jurisdiction: jur,
        status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
      })
    )
      .sort({ version: -1 })
      .lean()) ||
    (await LegalDocument.findOne(
      scope({ documentType, language: sourceLang, jurisdiction: jur })
    )
      .sort({ version: -1 })
      .lean());

  if (!source) {
    return {
      ok: false,
      code: "not_found",
      message: "Source document not found",
    };
  }

  const draft = await buildTranslationDraft({
    source,
    language: targetLang,
    sourceLanguage: sourceLang,
    mode: "missing",
    translateSection,
  });

  const result = await createDocumentVersion({
    documentType,
    language: targetLang,
    jurisdiction: jur,
    content: {
      title: sanitizeLegalHtml(draft.title || source.content?.title || ""),
      sections: (draft.sections || []).map((section) => ({
        id: section.id,
        heading: sanitizeLegalHtml(section.heading || ""),
        body: sanitizeLegalHtml(section.body || ""),
        requires: section.requires || [],
      })),
    },
    byEmail,
    note: `Translation draft from ${sourceLang} v${source.version} (not published)`,
  });

  return {
    ...result,
    source,
    draft: { ...draft, published: false, autoPublished: false },
  };
}

/**
 * Status overview for the superadmin Legal Configuration panel: which
 * document types have a published version in which languages.
 */
export async function getDocumentStatusOverview() {
  await connectToDB();
  const rows = await LegalDocument.find(scope())
    .select("documentType language version status checksum effectiveFrom updatedAt")
    .lean();

  return ALL_LEGAL_DOCUMENT_TYPES.map((documentType) => {
    const forType = rows.filter((r) => r.documentType === documentType);
    const languages = {};
    for (const language of LEGAL_LANGUAGES) {
      const published = forType
        .filter(
          (r) => r.language === language && r.status === LEGAL_DOCUMENT_STATUS.PUBLISHED
        )
        .sort((a, b) => b.version - a.version)[0];
      const anyVersion = forType
        .filter((r) => r.language === language)
        .sort((a, b) => b.version - a.version)[0];
      languages[language] = {
        published: published
          ? {
              version: published.version,
              checksum: published.checksum,
              effectiveFrom: published.effectiveFrom,
            }
          : null,
        latestVersion: anyVersion?.version ?? null,
        latestStatus: anyVersion?.status ?? "missing",
      };
    }
    return {
      documentType,
      languages,
      hasPublishedEnglish: Boolean(languages.en.published),
      hasPublishedSpanish: Boolean(languages.es.published),
    };
  });
}

/**
 * Published document, or the built-in draft when nothing is published yet.
 * The caller is told which one it got so a draft can be labelled as such.
 *
 * @param {{ documentType: string, language?: string, jurisdiction?: string }} params
 */
export async function resolveDocumentForDisplay({
  documentType,
  language,
  jurisdiction,
}) {
  const { doc, fellBackToEnglish } = await getPublishedDocument({
    documentType,
    language,
    jurisdiction,
  });
  if (doc) return { doc, source: "published", fellBackToEnglish };

  const seed = getSeedDocument(documentType, language);
  if (!seed) return { doc: null, source: "none", fellBackToEnglish: false };
  return {
    doc: seed,
    source: "draft",
    fellBackToEnglish: seed.language !== normalizeLegalLanguage(language),
  };
}

function normalizeContent(content) {
  return {
    title: content?.title || "",
    sections: (content?.sections || []).map((section) => ({
      id: String(section.id),
      heading: section.heading || "",
      body: section.body ?? section.text ?? "",
      requires: Array.isArray(section.requires) ? section.requires : [],
    })),
  };
}

/**
 * Save a draft. A published row is never edited; a new draft version is created.
 * Import and translation both use this and stay unpublished.
 */
export async function saveDocumentDraft({
  documentType,
  language,
  jurisdiction,
  content,
  byEmail = "",
  note = "",
  format = "sections",
  translationStatus = "",
  sourceChecksum = "",
  sourceVersion = 0,
  pdfFile = null,
}) {
  await connectToDB();
  const lang = normalizeLegalLanguage(language);
  const jur = normalizeJurisdiction(jurisdiction);
  const normalized = normalizeContent(content);

  const latest = await LegalDocument.findOne(
    scope({ documentType, language: lang, jurisdiction: jur })
  )
    .sort({ version: -1 });

  if (latest && latest.status === LEGAL_DOCUMENT_STATUS.DRAFT) {
    latest.content = normalized;
    latest.format = format || "sections";
    latest.translationStatus = translationStatus || latest.translationStatus || "";
    latest.sourceChecksum = sourceChecksum || latest.sourceChecksum || "";
    latest.sourceVersion = Number(sourceVersion || latest.sourceVersion || 0) || 0;
    if (pdfFile) latest.pdfFile = pdfFile;
    latest.checksum = computeDocumentChecksum({
      platform: LEGAL_PLATFORM,
      documentType,
      language: lang,
      jurisdiction: jur,
      version: latest.version,
      status: LEGAL_DOCUMENT_STATUS.DRAFT,
      effectiveFrom: null,
      content: normalized,
    });
    latest.history = [
      ...(latest.history || []),
      {
        version: latest.version,
        checksum: latest.checksum,
        status: LEGAL_DOCUMENT_STATUS.DRAFT,
        changedAt: new Date(),
        changedByEmail: byEmail,
        note: note || "Draft saved",
      },
    ];
    await latest.save();
    return { ok: true, doc: latest.toObject() };
  }

  const created = await createDocumentVersion({
    documentType,
    language: lang,
    jurisdiction: jur,
    content: normalized,
    byEmail,
    note: note || "New draft version",
  });
  if (!created.ok) return created;
  if (format || translationStatus || pdfFile || sourceChecksum) {
    const row = await LegalDocument.findById(created.doc._id);
    if (row) {
      row.format = format || "sections";
      row.translationStatus = translationStatus || "";
      row.sourceChecksum = sourceChecksum || "";
      row.sourceVersion = Number(sourceVersion || 0) || 0;
      if (pdfFile) row.pdfFile = pdfFile;
      await row.save();
      return { ok: true, doc: row.toObject() };
    }
  }
  return created;
}
