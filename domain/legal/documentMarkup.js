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
      if (styleLooksBold(styleValue)) text = `**${text}**`;
      if (styleLooksItalic(styleValue)) text = `*${text}*`;
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

  // Drop empty bold markers left by vacant tags.
  out = out.replace(/\*\*\s*\*\*/g, "");

  return out;
}

export function htmlToSections(html, title = "Document") {
  const source = String(html || "");
  const chunks = source.split(/<h[1-3][^>]*>/i);
  const sections = [];
  chunks.forEach((chunk, index) => {
    const headingMatch = index === 0 ? null : chunk.match(/^([\s\S]*?)<\/h[1-3]>/i);
    const heading = headingMatch ? inlineToMarkdown(headingMatch[1]).trim() : "";
    const rest = headingMatch ? chunk.slice(headingMatch[0].length) : chunk;
    const body = htmlBlockToMarkdown(rest).trim();
    if (!heading && !body) return;
    sections.push({
      id: String(sections.length + 1),
      heading: heading || (sections.length === 0 ? title : ""),
      body,
    });
  });
  if (!sections.length) {
    sections.push({ id: "1", heading: title, body: inlineToMarkdown(source).trim() });
  }
  return { title, sections };
}

function htmlBlockToMarkdown(html) {
  const marked = String(html || "")
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
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>'
    );
}

export function markdownToHtml(markdown) {
  const withInline = applyInlineMarkdown(escapeText(markdown));
  return withInline
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      const heading = /^(#{1,3})\s+(.+)$/s.exec(trimmed);
      if (heading) {
        const level = Math.min(3, heading[1].length);
        return `<h${level}>${heading[2].trim()}</h${level}>`;
      }
      if (/^\| /m.test(block) || block.includes("|")) {
        const rows = block
          .split("\n")
          .filter((row) => row.includes("|") && !/^\|?\s*-+/.test(row));
        if (rows.length > 1) {
          const cells = rows.map((row) =>
            row
              .split("|")
              .map((cell) => cell.trim())
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
          .map((line) => `<li>${line.replace(/^(- |\d+\. )/, "")}</li>`)
          .join("");
        return /^\d+\. /.test(block) ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
