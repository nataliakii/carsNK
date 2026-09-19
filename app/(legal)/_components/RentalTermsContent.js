"use client";

/**
 * Rental Terms Content Component
 *
 * Client Component — language from route locale (or localStorage).
 * Greece uses app/data/terms.js; Spain uses app/data/termsSpain.js
 * (general platform rules + company-specific disclaimer).
 */

import { useState, useEffect } from "react";
import {
  getRentalTermsByLocale,
  resolveRentalTermsLang,
} from "@app/data/getRentalTerms";

export default function RentalTermsContent({ forcedLang = null }) {
  const [lang, setLang] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const normalizedForcedLang =
      typeof forcedLang === "string" ? forcedLang.toLowerCase().split("-")[0] : null;

    if (normalizedForcedLang) {
      setLang(resolveRentalTermsLang(normalizedForcedLang));
      setIsHydrated(true);
      return;
    }

    const savedLang =
      typeof window !== "undefined"
        ? localStorage.getItem("selectedLanguage")
        : null;
    setLang(resolveRentalTermsLang(savedLang));
    setIsHydrated(true);
  }, [forcedLang]);

  const containerStyle = {
    width: "100%",
    maxWidth: 820,
    margin: "0 auto",
    padding: "24px 24px 48px",
    boxSizing: "border-box",
  };

  if (!isHydrated) {
    return (
      <div
        style={{
          ...containerStyle,
          textAlign: "center",
          paddingTop: "48px",
          paddingBottom: "48px",
        }}
      >
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  const bundle = getRentalTermsByLocale();
  const content = bundle[lang] || bundle.en;

  return (
    <div style={containerStyle}>
      <article style={{ margin: 0, padding: 0 }}>
        <h1
          style={{
            textAlign: "center",
            marginBottom: "40px",
            fontSize: "28px",
            fontWeight: "600",
          }}
        >
          {content.title}
        </h1>

        {content.subtitle1bold && (
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginTop: "32px",
              marginBottom: "16px",
            }}
          >
            {content.subtitle1bold}
          </h2>
        )}

        {content.text1 && (
          <p
            style={{
              lineHeight: "1.7",
              whiteSpace: "pre-line",
              color: "#37474f",
              marginBottom: "16px",
            }}
          >
            {content.text1}
          </p>
        )}

        {content.ul4 && content.ul4.length > 0 && (
          <ul
            style={{
              marginLeft: "24px",
              marginBottom: "16px",
              lineHeight: "1.7",
              color: "#37474f",
              fontSize: "16px",
            }}
          >
            {content.ul4.map((item, index) => (
              <li key={index} style={{ marginBottom: "8px" }}>
                {item}
              </li>
            ))}
          </ul>
        )}

        {content.text2 && (
          <p
            style={{
              lineHeight: "1.7",
              whiteSpace: "pre-line",
              color: "#37474f",
              marginBottom: "24px",
            }}
          >
            {content.text2}
          </p>
        )}

        {content.subtitle3bold && (
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginTop: "32px",
              marginBottom: "16px",
            }}
          >
            {content.subtitle3bold}
          </h2>
        )}

        {content.ul5 && content.ul5.length > 0 && (
          <ul
            style={{
              marginLeft: "24px",
              marginBottom: "16px",
              lineHeight: "1.7",
              color: "#37474f",
              fontSize: "16px",
            }}
          >
            {content.ul5.map((item, index) => (
              <li key={index} style={{ marginBottom: "8px", fontSize: "16px" }}>
                {item}
              </li>
            ))}
          </ul>
        )}

        {content.text7red && (
          <p
            style={{
              color: "#c62828",
              fontWeight: "600",
              marginTop: "24px",
              marginBottom: "16px",
            }}
          >
            {content.text7red}
          </p>
        )}

        {content.text3 && (
          <p
            style={{
              lineHeight: "1.7",
              whiteSpace: "pre-line",
              color: "#37474f",
              marginBottom: "16px",
            }}
          >
            {content.text3}
          </p>
        )}

        {content.ul6 && content.ul6.length > 0 && (
          <ul
            style={{
              marginLeft: "24px",
              marginBottom: "16px",
              lineHeight: "1.7",
              color: "#37474f",
              fontSize: "16px",
            }}
          >
            {content.ul6.map((item, index) => (
              <li key={index} style={{ marginBottom: "8px" }}>
                {item}
              </li>
            ))}
          </ul>
        )}

        {content.text4 && (
          <p
            style={{
              lineHeight: "1.7",
              color: "#37474f",
              marginBottom: "24px",
            }}
          >
            {content.text4}
          </p>
        )}

        {content.subtitle4bold && (
          <p
            style={{
              fontWeight: "600",
              marginTop: "32px",
              color: "#1a237e",
            }}
          >
            {content.subtitle4bold}
          </p>
        )}
      </article>
    </div>
  );
}
