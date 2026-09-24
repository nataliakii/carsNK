/**
 * Production repair: archive QA Customer Booking Terms and restore valid content.
 *
 * Default: dry-run only (no writes).
 * Apply:   node scripts/repairQaCustomerBookingTerms.mjs --apply
 *
 * Never prints full legal bodies or Mongo credentials.
 */

import { readFileSync } from "fs";
import { createHash, randomBytes } from "crypto";
import { MongoClient, ObjectId } from "mongodb";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  let val = m[2].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}

const APPLY = process.argv.includes("--apply");
const DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const PLATFORM = "rovaro";
const DOC_TYPE = "customer-booking-terms";
const BY_EMAIL = "incident-repair@rovaro.es";
const QA_TITLE = /\b(QA|Test|Draft\s*test)\b/i;
const QA_BODY = /draft\s*save\s*test/i;

function redactChecksum(cs) {
  if (!cs) return null;
  return `${String(cs).slice(0, 12)}…${String(cs).slice(-8)}`;
}

function canonicalize(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function computeDocumentChecksum(doc) {
  const payload = {
    platform: doc?.platform ?? "",
    documentType: doc?.documentType ?? "",
    language: doc?.language ?? "",
    jurisdiction: doc?.jurisdiction ?? "",
    version: Number(doc?.version ?? 0),
    title: doc?.content?.title ?? "",
    sections: (doc?.content?.sections || []).map((section) => ({
      id: section?.id ?? "",
      heading: section?.heading ?? "",
      body: section?.body ?? section?.text ?? "",
      requires: Array.isArray(section?.requires)
        ? [...section.requires].sort()
        : [],
    })),
  };
  return createHash("sha256")
    .update(canonicalize(payload), "utf8")
    .digest("hex");
}

function looksLikeQA(doc) {
  const title = doc?.content?.title || "";
  const body = (doc?.content?.sections || [])
    .map((s) => `${s.heading || ""}\n${s.body || ""}`)
    .join("\n");
  return QA_TITLE.test(title) || QA_BODY.test(body);
}

function safeMeta(doc) {
  const sections = doc?.content?.sections || [];
  const bodyChars = sections
    .map((s) => `${s.heading || ""}\n${s.body || ""}`)
    .join("\n").length;
  return {
    id: String(doc._id),
    documentType: doc.documentType,
    language: doc.language,
    jurisdiction: doc.jurisdiction,
    version: doc.version,
    status: doc.status,
    title: String(doc.content?.title || "").slice(0, 80),
    sectionCount: sections.length,
    bodyChars,
    checksum: redactChecksum(doc.checksum),
    createdAt: doc.createdAt,
    publishedAt: doc.publishedAt,
    publishedByEmail: doc.publishedByEmail || "",
    savedByEmail: doc.savedByEmail || "",
    sourceFilename: doc.sourceFilename || "",
    effectiveFrom: doc.effectiveFrom,
    archivedAt: doc.archivedAt || null,
    looksLikeQA: looksLikeQA(doc),
  };
}

function buildKeys({ documentType, language, jurisdiction, version }) {
  return {
    pk: `PLATFORM#${PLATFORM}#DOC#${documentType}`,
    sk: `LANG#${language}#JUR#${jurisdiction}#VERSION#${Number(version)}`,
  };
}

async function countRefs(db, checksums) {
  const counts = {
    orders_termsAcceptance_platform: 0,
    orders_termsAcceptance_privacy: 0,
    orders_legalSnapshot_any: 0,
    partner_agreement_acceptances: 0,
    partner_agreement_acceptances_documents: 0,
    confirmed_booking_snapshots: 0,
    partner_legal_profiles: 0,
  };
  for (const cs of checksums) {
    counts.orders_termsAcceptance_platform += await db
      .collection("orders")
      .countDocuments({ "termsAcceptance.platform.checksum": cs });
    counts.orders_termsAcceptance_privacy += await db
      .collection("orders")
      .countDocuments({ "termsAcceptance.privacy.checksum": cs });
    counts.orders_legalSnapshot_any += await db
      .collection("orders")
      .countDocuments({
        $or: [
          { "legalSnapshot.checksum": cs },
          { "legalSnapshot.platform.checksum": cs },
          { "legalSnapshot.documents.checksum": cs },
        ],
      });
    counts.partner_agreement_acceptances += await db
      .collection("partner_agreement_acceptances")
      .countDocuments({ checksum: cs });
    counts.partner_agreement_acceptances_documents += await db
      .collection("partner_agreement_acceptances")
      .countDocuments({ "documents.checksum": cs });
    counts.confirmed_booking_snapshots += await db
      .collection("confirmed_booking_snapshots")
      .countDocuments({ checksum: cs });
    counts.partner_legal_profiles += await db
      .collection("partner_legal_profiles")
      .countDocuments({
        $or: [
          { "acceptedAgreement.checksum": cs },
          { "documents.checksum": cs },
        ],
      });
  }
  return counts;
}

async function archiveDoc(col, doc, note) {
  const now = new Date();
  const history = [
    ...(doc.history || []),
    {
      version: doc.version,
      checksum: doc.checksum,
      status: "archived",
      archivedAt: now,
      changedAt: now,
      changedByEmail: BY_EMAIL,
      note,
    },
  ];
  await col.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "archived",
        archivedAt: now,
        history,
        updatedAt: now,
      },
    }
  );
  return { id: String(doc._id), version: doc.version, language: doc.language };
}

async function publishDoc(col, doc, note) {
  const now = new Date();
  const history = [
    ...(doc.history || []),
    {
      version: doc.version,
      checksum: doc.checksum,
      status: "published",
      effectiveFrom: now,
      changedAt: now,
      changedByEmail: BY_EMAIL,
      note,
    },
  ];
  await col.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "published",
        publishedAt: now,
        publishedByEmail: BY_EMAIL,
        effectiveFrom: now,
        archivedAt: null,
        history,
        updatedAt: now,
      },
    }
  );
  return { id: String(doc._id), version: doc.version, language: doc.language, checksum: redactChecksum(doc.checksum) };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  const host = uri.match(/@([^/?]+)/)?.[1] || "?";

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 25000,
    family: 4,
  });
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection("legal_documents");

  // Confirm this DB has the live QA EN title before writing
  const publishedBooking = await col
    .find({
      platform: PLATFORM,
      documentType: DOC_TYPE,
      status: "published",
    })
    .toArray();

  const badPublished = publishedBooking.filter(looksLikeQA);
  const allOfType = await col
    .find({ platform: PLATFORM, documentType: DOC_TYPE })
    .toArray();

  const byLang = {};
  for (const d of allOfType) {
    (byLang[d.language] ||= []).push(d);
  }

  const seedMod = await import(
    "../domain/legal/content/customer-booking-terms.en.js"
  );
  const seedEn = seedMod.default;

  const plan = [];

  // EN: archive QA published v1, insert seed as next draft version, publish it
  const badEn = badPublished.find((d) => d.language === "en");
  const enVersions = byLang.en || [];
  const maxEn = Math.max(0, ...enVersions.map((d) => Number(d.version) || 0));
  const nextEnVersion = maxEn + 1;
  const enDraftContent = {
    title: seedEn.content.title,
    sections: seedEn.content.sections,
  };
  const enDraftBase = {
    platform: PLATFORM,
    documentType: DOC_TYPE,
    language: "en",
    jurisdiction: "EU",
    version: nextEnVersion,
    status: "draft",
    effectiveFrom: null,
    content: enDraftContent,
  };
  const enChecksum = computeDocumentChecksum(enDraftBase);
  const enKeys = buildKeys(enDraftBase);

  plan.push({
    action: "archive",
    reason: "QA test content live on /en/terms",
    target: badEn ? safeMeta(badEn) : null,
  });
  plan.push({
    action: "create_and_publish_from_seed",
    language: "en",
    newVersion: nextEnVersion,
    title: enDraftContent.title.slice(0, 80),
    sectionCount: enDraftContent.sections.length,
    checksum: redactChecksum(enChecksum),
    replacementSource: "repo seed domain/legal/content/customer-booking-terms.en.js",
  });

  // ES: archive QA published, publish good draft v1
  const badEs = badPublished.find((d) => d.language === "es");
  const goodEs = (byLang.es || [])
    .filter((d) => !looksLikeQA(d) && (d.content?.sections || []).length > 5)
    .sort((a, b) => b.version - a.version)[0];
  plan.push({
    action: "archive",
    reason: "QA test content live on /es/terms",
    target: badEs ? safeMeta(badEs) : null,
  });
  plan.push({
    action: "publish_existing",
    target: goodEs ? safeMeta(goodEs) : null,
  });

  // RU / UK: archive QA published; no seed — leave unpublished (EN fallback)
  for (const lang of ["ru", "uk"]) {
    const bad = badPublished.find((d) => d.language === lang);
    if (bad) {
      plan.push({
        action: "archive_only",
        reason: `QA published ${lang}; no valid non-QA replacement — public pages fall back to EN`,
        target: safeMeta(bad),
      });
    }
  }

  // Also scan other published docs for QA
  const otherPublishedQA = await col
    .find({ platform: PLATFORM, status: "published" })
    .toArray()
    .then((rows) =>
      rows.filter((d) => d.documentType !== DOC_TYPE && looksLikeQA(d)).map(safeMeta)
    );

  const qaChecksums = [
    ...new Set(
      allOfType.filter(looksLikeQA).map((d) => d.checksum).filter(Boolean)
    ),
  ];
  const acceptanceCounts = await countRefs(db, qaChecksums);

  console.log(
    JSON.stringify(
      {
        phase: "DRY_RUN_SUMMARY",
        mutate: false,
        applyFlag: APPLY,
        host,
        dbName: DB_NAME,
        bad_documents: badPublished.map(safeMeta),
        repair_plan: plan,
        other_published_qa: otherPublishedQA,
        acceptance_snapshot_counts_for_qa_checksums: acceptanceCounts,
        qa_checksum_count: qaChecksums.length,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log(
      JSON.stringify({
        phase: "dry_run_complete",
        hint: "Re-run with --apply to archive QA and publish valid terms",
      })
    );
    await client.close();
    return;
  }

  if (!badEn) {
    throw new Error("Abort: expected published QA EN booking terms not found");
  }
  if (!goodEs) {
    throw new Error("Abort: no valid ES draft to publish");
  }

  // Confirm production fingerprint: EN published title QA
  if (!looksLikeQA(badEn)) {
    throw new Error("Abort: EN published doc no longer looks like QA");
  }

  const results = { archived: [], published: [], created: null };

  // 1) Archive all bad published booking-terms (en/es/ru/uk)
  for (const bad of badPublished) {
    results.archived.push(
      await archiveDoc(
        col,
        bad,
        `Incident repair: archive QA/test published content (${bad.language} v${bad.version})`
      )
    );
  }

  // 2) Create EN draft from seed and publish
  const now = new Date();
  const enInsert = {
    ...enDraftBase,
    checksum: enChecksum,
    ...enKeys,
    publishedAt: null,
    publishedByEmail: "",
    archivedAt: null,
    sourceFilename: "",
    savedByEmail: BY_EMAIL,
    history: [
      {
        version: nextEnVersion,
        checksum: enChecksum,
        status: "draft",
        changedAt: now,
        changedByEmail: BY_EMAIL,
        note: "Incident repair: restored from built-in seed after QA overwrite",
      },
    ],
    format: "sections",
    translationStatus: "",
    sourceChecksum: "",
    sourceVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  const insertResult = await col.insertOne(enInsert);
  results.created = {
    id: String(insertResult.insertedId),
    version: nextEnVersion,
    language: "en",
    checksum: redactChecksum(enChecksum),
    title: enDraftContent.title.slice(0, 80),
    sectionCount: enDraftContent.sections.length,
  };
  const enCreated = await col.findOne({ _id: insertResult.insertedId });
  results.published.push(
    await publishDoc(
      col,
      enCreated,
      "Incident repair: publish restored English Customer Booking Terms"
    )
  );

  // 3) Publish good ES draft
  // Ensure no other published ES remains
  const stillPubEs = await col
    .find({
      platform: PLATFORM,
      documentType: DOC_TYPE,
      language: "es",
      status: "published",
      _id: { $ne: goodEs._id },
    })
    .toArray();
  for (const extra of stillPubEs) {
    results.archived.push(
      await archiveDoc(col, extra, "Incident repair: clear duplicate published ES")
    );
  }
  const esFresh = await col.findOne({ _id: goodEs._id });
  results.published.push(
    await publishDoc(
      col,
      esFresh,
      "Incident repair: publish valid Spanish Customer Booking Terms draft"
    )
  );

  // Verify: exactly one published per lang en/es, none QA
  const after = await col
    .find({
      platform: PLATFORM,
      documentType: DOC_TYPE,
      status: "published",
    })
    .toArray();
  const verify = after.map(safeMeta);
  const qaStillLive = verify.filter((v) => v.looksLikeQA);

  console.log(
    JSON.stringify(
      {
        phase: "REPAIR_APPLIED",
        results,
        published_after: verify,
        qa_still_live: qaStillLive,
        ok: qaStillLive.length === 0 && verify.some((v) => v.language === "en"),
      },
      null,
      2
    )
  );

  await client.close();
  if (qaStillLive.length) process.exit(2);
}

main().catch((err) => {
  console.error(JSON.stringify({ phase: "error", message: String(err?.message || err) }));
  process.exit(1);
});
