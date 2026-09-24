/**
 * Safe legal markup. Stored as section text, never as executable HTML.
 * Supported: headings, paragraphs, bold, italic, lists, tables, links.
 */

const TOKEN = /\{\{[^}]+\}\}/g;

export function protectTokens(text) {
  const tokens = [];
  const safe = String(text || "").replace(TOKEN, (match) => {
    const id = tokens.length;
    tokens.push(match);
    return `⟦${id}⟧`;
  });
  return { safe, tokens };
}

export function restoreTokens(text, tokens = []) {
  return String(text || "").replace(/⟦(\d+)⟧/g, (_, n) => tokens[Number(n)] || "");
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function styleLooksBold(style) {
  return /font-weight\s*:\s*(bold|[5-9]00)/i.test(String(style || ""));
}

function styleLooksItalic(style) {
  return /font-style\s*:\s*italic/i.test(String(style || ""));
}

/**
 * Convert inline HTML (from contentEditable) to markdown markers.
 * Handles <b>/<strong>/<i>/<em> with attributes and style-based spans
 * that Chromium often emits instead of semantic tags.
 */
export function inlineToMarkdown(html) {
  let out = String(html || "");

  out = out.replace(/<br\s*\/?>/gi, "\n");

  // Style-based spans first (Chrome bold/italic without <b>/<i>).
  out = out.replace(
    /<span\b([^>]*)>([\s\S]*?)<\/span>/gi,
    (full, attrs, inner) => {
      const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs || "");
      const styleValue = style ? style[2] || style[3] || "" : "";
      let text = inlineToMarkdown(inner);
      // Only mark inline runs — never wrap multi-block content in **.
      if (styleLooksBold(styleValue) && !/\n/.test(text)) text = `**${text}**`;
      if (styleLooksItalic(styleValue) && !/\n/.test(text)) text = `*${text}*`;
      return text;
    }
  );

  out = out
    .replace(/<(strong|b)\b[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)\b[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, label) => {
        const url = String(href || "").trim();
        const text = inlineToMarkdown(label).replace(/\n+/g, " ").trim();
        if (!/^https?:\/\//i.test(url)) return text;
        return `[${text}](${url})`;
      }
    )
    .replace(/<[^>]+>/g, "");

  out = decodeEntities(out);

  // Drop empty bold markers left by vacant tags (same line only — never
  // join adjacent **paragraph**\n**paragraph** into one giant bold run).
  out = out.replace(/\*\*[^\S\n]*\*\*/g, "");
  out = out
    .split("\n")
    .map((line) => {
      if (!line.includes("**")) return line;
      if (/\*\*[^*]+\*\*/.test(line)) return line;
      return line.replace(/\*\*/g, "");
    })
    .join("\n");

  return out;
}

/** Strip wrapping bold markers from headings — CSS already emphasizes them. */
export function cleanHeadingMarkdown(text) {
  return String(text || "")
    .replace(/^\*\*(.+)\*\*$/s, "$1")
    .replace(/^\*(.+)\*$/s, "$1")
    .trim();
}

/**
 * Undo accidental "select all → Bold" / per-paragraph <b> wraps.
 * - Whole block wrapped in **…** → plain
 * - Any full line wrapped in **…** → plain (keeps **partial** bold)
 */
export function unwrapAccidentalFullBold(markdown) {
  return String(markdown || "")
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return block;

      const heading = /^(#{1,3}\s+)([\s\S]+)$/.exec(trimmed);
      if (heading) {
        return `${heading[1]}${cleanHeadingMarkdown(heading[2])}`;
      }

      const full = /^\*\*([^*]+)\*\*$/s.exec(trimmed);
      if (full) return full[1].trim();

      return trimmed
        .split("\n")
        .map((line) => {
          const t = line.trim();
          if (!t) return "";
          const only = /^\*\*([^*]+)\*\*$/.exec(t);
          return only ? only[1] : line;
        })
        .join("\n");
    })
    .join("\n\n");
}

export function htmlToSections(html, title = "Document") {
  let source = String(html || "");
  // Unwrap a single outer <b>/<strong> that Chromium may wrap around the
  // whole document after "select all → Bold".
  source = source.replace(
    /^\s*<(strong|b)\b[^>]*>([\s\S]*)<\/\1>\s*$/i,
    "$2"
  );
  const chunks = source.split(/<h[1-3][^>]*>/i);
  const sections = [];
  chunks.forEach((chunk, index) => {
    const headingMatch = index === 0 ? null : chunk.match(/^([\s\S]*?)<\/h[1-3]>/i);
    const heading = headingMatch
      ? cleanHeadingMarkdown(inlineToMarkdown(headingMatch[1]))
      : "";
    const rest = headingMatch ? chunk.slice(headingMatch[0].length) : chunk;
    const body = unwrapAccidentalFullBold(htmlBlockToMarkdown(rest).trim());
    if (!heading && !body) return;
    sections.push({
      id: String(sections.length + 1),
      heading: heading || (sections.length === 0 ? title : ""),
      body,
    });
  });
  if (!sections.length) {
    sections.push({
      id: "1",
      heading: title,
      body: unwrapAccidentalFullBold(inlineToMarkdown(source).trim()),
    });
  }
  return { title, sections };
}

function htmlBlockToMarkdown(html) {
  // Convert each paragraph on its own so adjacent <b>…</b> blocks cannot
  // be glued into one **…** run when empty-marker cleanup runs.
  let source = String(html || "");
  const paragraphs = [];
  source = source.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    paragraphs.push(unwrapBlockEmphasis(inner));
    return "\n";
  });
  if (paragraphs.length) {
    const rest = inlineToMarkdown(
      source
        .replace(/<li[^>]*>/gi, "\n- ")
        .replace(/<\/li>/gi, "")
        .replace(/<\/?(ol|ul|div|h[1-3])[^>]*>/gi, "\n")
        .replace(/<tr[^>]*>/gi, "\n")
        .replace(/<\/tr>/gi, " |")
        .replace(/<t[dh][^>]*>/gi, "| ")
        .replace(/<\/t[dh]>/gi, " ")
        .replace(/<\/?(table|thead|tbody)[^>]*>/gi, "\n")
    ).trim();
    const parts = paragraphs.map((p) => inlineToMarkdown(p).trim()).filter(Boolean);
    if (rest) parts.push(rest);
    return parts.join("\n");
  }

  const marked = source
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(ol|ul|p|div|h[1-3])>/gi, "\n")
    .replace(/<(ol|ul|p|div)[^>]*>/gi, "")
    .replace(/<tr[^>]*>/gi, "\n")
    .replace(/<\/tr>/gi, " |")
    .replace(/<t[dh][^>]*>/gi, "| ")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<\/?(table|thead|tbody)[^>]*>/gi, "\n");
  return inlineToMarkdown(marked);
}

/** If a block is only a single <b>/<strong>/<span bold> wrapper, unwrap it. */
function unwrapBlockEmphasis(html) {
  let out = String(html || "").trim();
  let guard = 0;
  while (guard < 4) {
    guard += 1;
    const bold = /^<(strong|b)\b[^>]*>([\s\S]*)<\/\1>$/i.exec(out);
    if (bold) {
      out = bold[2].trim();
      continue;
    }
    const span = /^<span\b([^>]*)>([\s\S]*)<\/span>$/i.exec(out);
    if (span) {
      const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(span[1] || "");
      const styleValue = style ? style[2] || style[3] || "" : "";
      if (styleLooksBold(styleValue) || styleLooksItalic(styleValue)) {
        // Unwrap full-block style span; italic-only keep via markers later if partial.
        if (styleLooksBold(styleValue) && !styleLooksItalic(styleValue)) {
          out = span[2].trim();
          continue;
        }
      }
    }
    break;
  }
  return out;
}

export function markdownToSections(markdown, title = "Document") {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = { heading: title, lines: [] };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      if (current.heading || current.lines.join("").trim()) {
        sections.push(current);
      }
      current = { heading: heading[2].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return {
    title,
    sections: sections
      .map((section, index) => ({
        id: String(index + 1),
        heading: section.heading || "",
        body: section.lines.join("\n").trim(),
      }))
      .filter((section) => section.heading || section.body),
  };
}

export function plainTextToSections(text, title = "Document") {
  const body = String(text || "").replace(/\r\n/g, "\n").trim();
  return { title, sections: [{ id: "1", heading: title, body }] };
}

/** Flatten sections to markdown for the rich-text editor (keeps ## headings). */
export function sectionsToPlain(sections) {
  return (sections || [])
    .map((section) => {
      const heading = String(section.heading || "").trim();
      const body = String(section.body || "").trim();
      if (heading && body) return `## ${heading}\n\n${body}`;
      if (heading) return `## ${heading}`;
      return body;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Structural nodes used for translation completeness, not length alone. */
export function structuralNodes(sections) {
  const nodes = [];
  for (const section of sections || []) {
    nodes.push({ type: "heading", id: section.id });
    const body = String(section.body || "");
    if (/^\s*[-*]\s/m.test(body) || /^\s*\d+\.\s/m.test(body)) nodes.push({ type: "list", id: section.id });
    if (/\|/.test(body)) nodes.push({ type: "table", id: section.id });
    if (/\[[^\]]+\]\(https?:\/\//.test(body)) nodes.push({ type: "link", id: section.id });
    nodes.push({ type: "paragraph", id: section.id });
  }
  return nodes;
}

export function sameStructure(sourceSections, translatedSections) {
  const left = structuralNodes(sourceSections);
  const right = structuralNodes(translatedSections);
  if (left.length !== right.length) return false;
  return left.every((node, index) => node.type === right[index]?.type && node.id === right[index]?.id);
}

function applyInlineMarkdown(escaped) {
  return String(escaped || "")
    // Inline only — never match across newlines (that orphaned <strong> tags).
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>'
    );
}

/** Safe HTML for a heading or short inline string (no block wrappers). */
export function markdownInlineToHtml(text) {
  return applyInlineMarkdown(escapeText(cleanHeadingMarkdown(text)));
}

export function markdownToHtml(markdown) {
  // Apply inline markers per block so a stray ** cannot wrap the whole doc.
  // Also unwrap accidental full-paragraph bold left by a bad save.
  return unwrapAccidentalFullBold(markdown)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const heading = /^(#{1,3})\s+(.+)$/s.exec(trimmed);
      if (heading) {
        const level = Math.min(3, heading[1].length);
        const title = applyInlineMarkdown(
          escapeText(cleanHeadingMarkdown(heading[2].trim()))
        );
        return `<h${level}>${title}</h${level}>`;
      }
      const withInline = applyInlineMarkdown(escapeText(block));
      if (/^\| /m.test(block) || block.includes("|")) {
        const rows = block
          .split("\n")
          .filter((row) => row.includes("|") && !/^\|?\s*-+/.test(row));
        if (rows.length > 1) {
          const cells = rows.map((row) =>
            row
              .split("|")
              .map((cell) => applyInlineMarkdown(escapeText(cell.trim())))
              .filter(Boolean)
          );
          const head = cells[0].map((cell) => `<th>${cell}</th>`).join("");
          const body = cells
            .slice(1)
            .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
            .join("");
          return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
        }
      }
      if (/^(?:- |\d+\. )/m.test(block)) {
        const items = block
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const item = line.replace(/^(- |\d+\. )/, "");
            return `<li>${applyInlineMarkdown(escapeText(item))}</li>`;
          })
          .join("");
        return /^\d+\. /.test(block) ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }
      return `<p>${withInline.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
