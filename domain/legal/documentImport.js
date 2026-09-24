/**
 * Import DOCX, Markdown, plain text and PDF into the safe section format.
 * Import never publishes. PDF extraction is never treated as complete unless
 * the file actually contains extractable text covering the upload.
 */

import crypto from "crypto";
import zlib from "zlib";

import { sanitizeLegalHtml } from "./contentSanitizer";
import { htmlToSections, markdownToSections, plainTextToSections } from "./documentMarkup";

export const IMPORT_MAX_BYTES = 8 * 1024 * 1024;

const MACRO = /vbaProject\.bin|macrosheets\/|word\/vba/i;
const UNSAFE = /<script|javascript:|onerror=|onload=|<\?php|<!\[CDATA\[.*?eval/i;

export function readZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buf.slice(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    const compressed = buf.slice(dataStart, dataStart + compSize);
    let data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    else if (method !== 0) {
      throw new Error("Unsupported compression in uploaded file");
    }
    entries.set(name, data);
    offset = dataStart + compSize;
  }
  return entries;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function docxXmlToSections(xml) {
  const safe = sanitizeLegalHtml(String(xml || ""));
  const blocks = [];
  const parts = safe.split(/<w:p[\s>]/);
  for (const part of parts) {
    const style = /<w:pStyle[^>]*w:val="([^"]+)"/.exec(part);
    const texts = [...part.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1]));
    if (!texts.length) continue;
    const text = texts.join("");
    const bold = /<w:b\/>|<w:b[\s>]/.test(part);
    const italic = /<w:i\/>|<w:i[\s>]/.test(part);
    let line = text;
    if (bold) line = `**${line}**`;
    if (italic) line = `*${line}*`;
    const styleName = style?.[1] || "";
    if (/heading/i.test(styleName)) blocks.push(`# ${text}`);
    else blocks.push(line);
  }
  const tableChunks = [...safe.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)];
  for (const table of tableChunks) {
    const rows = [...table[0].matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((row) => {
      const cells = [...row[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((cell) => {
        const bits = [...cell[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1]));
        return bits.join(" ");
      });
      return `| ${cells.join(" | ")} |`;
    });
    if (rows.length) blocks.push(rows.join("\n"));
  }
  return markdownToSections(blocks.join("\n\n"), "Imported document");
}

function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const pieces = [];
  for (const match of raw.matchAll(/\((?:\\\)|[^)]){2,}\)\s*Tj/g)) {
    pieces.push(match[0].slice(1, match[0].lastIndexOf(")")).replace(/\\n/g, "\n"));
  }
  const text = pieces.join("\n").replace(/[^\S\n]+/g, " ").trim();
  return text;
}

export function importLegalFile({ filename = "", bytes, title = "" } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || "");
  if (!buf.length) return { ok: false, code: "empty", message: "The file is empty" };
  if (buf.length > IMPORT_MAX_BYTES) {
    return { ok: false, code: "too_large", message: "The file is larger than 8 MB" };
  }
  const name = String(filename || "").toLowerCase();
  const asText = buf.toString("utf8");
  if (UNSAFE.test(asText) || MACRO.test(asText)) {
    return { ok: false, code: "unsafe", message: "Macros, scripts and executable content are rejected" };
  }

  const fileMeta = {
    filename: filename || "upload",
    fileSize: buf.length,
    fileType: name.endsWith(".pdf")
      ? "application/pdf"
      : name.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : name.endsWith(".md") || name.endsWith(".markdown")
          ? "text/markdown"
          : name.endsWith(".txt")
            ? "text/plain"
            : "application/octet-stream",
  };

  function withMeta(result) {
    if (!result?.ok) return result;
    const sections = result.content?.sections || [];
    const detectedLanguage = detectLanguageHint(sections, filename);
    return {
      ...result,
      ...fileMeta,
      detectedLanguage,
      sectionCount: sections.length,
      incomplete: Boolean(
        result.extractionComplete === false ||
          (result.previewRequired && sections.length === 0)
      ),
      published: false,
    };
  }

  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    const content = markdownToSections(asText, title || "Imported document");
    return withMeta({
      ok: true,
      format: "markdown",
      editable: true,
      published: false,
      content,
    });
  }
  if (name.endsWith(".txt")) {
    return withMeta({
      ok: true,
      format: "text",
      editable: true,
      published: false,
      content: plainTextToSections(asText, title || "Imported document"),
    });
  }
  if (name.endsWith(".docx")) {
    let entries;
    try {
      entries = readZipEntries(buf);
    } catch (err) {
      return { ok: false, code: "unreadable", message: err.message || "Could not read DOCX" };
    }
    for (const entryName of entries.keys()) {
      if (MACRO.test(entryName)) {
        return { ok: false, code: "unsafe", message: "DOCX macros are rejected" };
      }
    }
    const xml = entries.get("word/document.xml");
    if (!xml) return { ok: false, code: "unreadable", message: "DOCX has no document.xml" };
    const content = docxXmlToSections(xml.toString("utf8"));
    return withMeta({
      ok: true,
      format: "docx",
      editable: true,
      published: false,
      content,
      previewRequired: true,
    });
  }
  if (name.endsWith(".pdf")) {
    const extracted = extractPdfText(buf);
    const extractionComplete = extracted.length > 40 && extracted.length > buf.length / 80;
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    return withMeta({
      ok: true,
      format: "pdf",
      editable: false,
      published: false,
      extractionComplete,
      extractionNotice: extractionComplete
        ? "Text was extracted. Review the conversion before saving a draft. The original PDF is kept."
        : "We could not reliably convert this PDF into editable text. You can keep it as a PDF or create the text manually.",
      pdf: {
        filename: filename || "document.pdf",
        size: buf.length,
        sha256,
        data: buf.toString("base64"),
      },
      content: extractionComplete
        ? plainTextToSections(extracted, title || "Converted from PDF")
        : { title: title || filename || "PDF", sections: [] },
      conversionDraft: extractionComplete,
    });
  }
  return {
    ok: false,
    code: "unsupported",
    message: "Upload DOCX, Markdown, plain text or PDF",
  };
}

function detectLanguageHint(sections, filename = "") {
  const sample = `${filename}\n${(sections || [])
    .map((s) => `${s.heading || ""} ${s.body || ""}`)
    .join(" ")}`.toLowerCase();
  if (/[а-яіїєґ]/.test(sample) && /(і|ї|є|ґ)/.test(sample)) return "uk";
  if (/[а-яё]/.test(sample)) return "ru";
  if (
    /\b(el|los|las|para|condiciones|privacidad|proveedor)\b/.test(sample) ||
    /[áéíóúñ¿¡]/.test(sample)
  ) {
    return "es";
  }
  return "en";
}
