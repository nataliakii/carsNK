import React from "react";
import Link from "@mui/material/Link";

/**
 * Renders a conflict message where the buffer settings phrase becomes a clickable button.
 * Recognized tokens: "Изменить буфер — ⚙️" (canonical) or "⚙️ Настройки буфера" / "Настройки буфера" (legacy).
 *
 * IMPORTANT:
 * - Does not change wording, only link rendering.
 * - Keeps original text segments intact.
 */
export function BufferSettingsLinkifiedText({ text, onOpen }) {
  if (!text) return null;
  if (typeof text !== "string") return text;

  // Canonical: "Изменить буфер — ⚙️" (whole phrase = button). Legacy: "⚙️ Настройки буфера" / "Настройки буфера".
  const tokenRe = /(Изменить буфер — ⚙️|⚙️\s*Настройки буфера|Настройки буфера)/g;
  const parts = text.split(tokenRe);

  // If no matches, render as plain text
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, idx) => {
        const isToken =
          part === "Изменить буфер — ⚙️" ||
          part === "Настройки буфера" ||
          part === "⚙️ Настройки буфера" ||
          part === "⚙️  Настройки буфера";

        if (!isToken) return <React.Fragment key={idx}>{part}</React.Fragment>;

        if (!onOpen) return <React.Fragment key={idx}>{part}</React.Fragment>;

        return (
          <Link
            key={idx}
            component="button"
            type="button"
            underline="always"
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
            sx={{ typography: "inherit" }}
          >
            {part}
          </Link>
        );
      })}
    </>
  );
}

