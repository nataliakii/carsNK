"use client";

/**
 * Legal Page Content Component
 * 
 * Client Component - reads language from localStorage
 * Fetches and renders legal documents with minimal styling
 */

import { useState, useEffect } from "react";
import { getLegalDoc } from "@utils/action";

export default function LegalPageContent({ docType, jur = "EU", forcedLang = null }) {
  const [lang, setLang] = useState(null); // null = not yet determined
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Route locale has priority. For unsupported document locales, fallback to English.
  useEffect(() => {
    const supportedDocLangs = ["en", "el", "ru"];
    const normalizedForcedLang =
      typeof forcedLang === "string" ? forcedLang.toLowerCase().split("-")[0] : null;

    if (normalizedForcedLang) {
      setLang(
        supportedDocLangs.includes(normalizedForcedLang) ? normalizedForcedLang : "en"
      );
      return;
    }

    const savedLang = localStorage.getItem("selectedLanguage");
    if (savedLang && supportedDocLangs.includes(savedLang)) {
      setLang(savedLang);
      return;
    }

    setLang("en");
  }, [forcedLang]);

  // Fetch document when language is determined
  useEffect(() => {
    // Don't fetch until language is determined
    if (lang === null) return;

    let cancelled = false;

    async function fetchDoc() {
      try {
        setLoading(true);
        setError(null);
        const data = await getLegalDoc({ docType, lang, jur });
        if (!cancelled) {
          setDoc(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDoc();

    return () => {
      cancelled = true;
    };
  }, [docType, lang, jur]);

  const contentPadding = { maxWidth: 820, margin: "0 auto", padding: "24px 20px 48px" };

  if (loading) {
    return (
      <div style={{ ...contentPadding, textAlign: "center", paddingTop: "48px", paddingBottom: "48px" }}>
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          ...contentPadding,
          paddingTop: "24px",
          paddingBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            backgroundColor: "#ffebee",
            borderRadius: "4px",
            color: "#c62828",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!doc || !doc.content) {
    return (
      <div
        style={{
          ...contentPadding,
          paddingTop: "24px",
          paddingBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            backgroundColor: "#fff3e0",
            borderRadius: "4px",
            color: "#e65100",
          }}
        >
          No content available
        </div>
      </div>
    );
  }

  const { title, sections } = doc.content;

  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <div style={contentPadding}>
        <h1 style={{ textAlign: "center", marginBottom: "32px" }}>
          {title || "Legal Document"}
        </h1>
        <div
          style={{
            padding: "16px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            color: "#1565c0",
          }}
        >
          No content available
        </div>
      </div>
    );
  }

  return (
    <article
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "24px 20px 48px",
      }}
    >
      {doc.stale && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#fff3e0",
            borderRadius: "4px",
            marginBottom: "24px",
            color: "#e65100",
            fontSize: "14px",
          }}
        >
          Showing cached content. Unable to fetch latest version.
        </div>
      )}

      <h1
        style={{
          textAlign: "center",
          marginBottom: "40px",
          fontSize: "28px",
          fontWeight: "600",
        }}
      >
        {title}
      </h1>

      {sections.map((section, index) => {
        if (!section || !section.text) {
          return null;
        }

        return (
          <section
            key={section.id || index}
            style={{
              marginBottom: "24px",
              lineHeight: "1.7",
              whiteSpace: "pre-line",
              color: "#37474f",
            }}
          >
            {section.text}
          </section>
        );
      })}
    </article>
  );
}
