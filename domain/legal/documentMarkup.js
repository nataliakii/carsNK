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

export function inlineToMarkdown(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong>|<b>/gi, "**")
    .replace(/<\/strong>|<\/b>/gi, "**")
    .replace(/<em>|<i>/gi, "*")
    .replace(/<\/em>|<\/i>/gi, "*")
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const url = String(href || "").trim();
      if (!/^https?:\/\//i.test(url)) return label.replace(/<[^>]+>/g, "");
      return `[${label.replace(/<[^>]+>/g, "")}](${url})`;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

export function sectionsToPlain(sections) {
  return (sections || [])
    .map((section) => `${section.heading || ""}\n${section.body || ""}`.trim())
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

export function markdownToHtml(markdown) {
  const escaped = escapeText(markdown);
  const withInline = escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return withInline
    .split(/\n{2,}/)
    .map((block) => {
      if (/^\| /m.test(block) || block.includes("|")) {
        const rows = block.split("\n").filter((row) => row.includes("|") && !/^\|?\s*-+/.test(row));
        if (rows.length > 1) {
          const cells = rows.map((row) => row.split("|").map((cell) => cell.trim()).filter(Boolean));
          const head = cells[0].map((cell) => `<th>${cell}</th>`).join("");
          const body = cells.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
          return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
        }
      }
      if (/^(?:- |\d+\. )/m.test(block)) {
        const items = block.split("\n").filter(Boolean).map((line) => `<li>${line.replace(/^(- |\d+\. )/, "")}</li>`).join("");
        return /^\d+\. /.test(block) ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
