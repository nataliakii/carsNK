import type { MetadataRoute } from "next";

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds a readable, pretty-printed sitemap XML string from Next.js Sitemap entries.
 * Keeps the same structure and alternates (hreflang) as the default serializer.
 */
export function sitemapToPrettyXml(entries: MetadataRoute.Sitemap): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${SITEMAP_NS}" xmlns:xhtml="${XHTML_NS}">`,
  ];

  const indent = "  ";
  const indent2 = "    ";

  for (const entry of entries) {
    lines.push(`${indent}<url>`);
    lines.push(`${indent2}<loc>${escapeXml(entry.url)}</loc>`);
    if (entry.lastModified) {
      const lastmod =
        typeof entry.lastModified === "string"
          ? entry.lastModified
          : new Date(entry.lastModified).toISOString();
      lines.push(`${indent2}<lastmod>${escapeXml(lastmod)}</lastmod>`);
    }
    if (entry.changeFrequency) {
      lines.push(`${indent2}<changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`);
    }
    if (entry.priority != null) {
      lines.push(`${indent2}<priority>${Number(entry.priority)}</priority>`);
    }
    const languages = entry.alternates?.languages;
    if (languages && typeof languages === "object") {
      const locales = Object.keys(languages).sort();
      for (const locale of locales) {
        const href = languages[locale];
        if (href) {
          lines.push(
            `${indent2}<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}"/>`
          );
        }
      }
    }
    lines.push(`${indent}</url>`);
  }

  lines.push("</urlset>");
  return lines.join("\n");
}
