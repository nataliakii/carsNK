"use client";

import { PUBLIC_LEGAL_STATUS_ERROR } from "@/domain/legal/publicLegalPageLayout";

/**
 * Friendly public error for legal pages. Technical details stay server-side.
 * Renders inside PublicLegalPageLayout MainContainer — no nested max-width.
 */
export default function LegalDocumentRetry({
  message = "We could not load this page right now. Please try again.",
}) {
  return (
    <div data-testid="public-legal-error" style={PUBLIC_LEGAL_STATUS_ERROR}>
      <p style={{ margin: "0 0 12px" }}>{message}</p>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
        style={{
          border: "1px solid #c62828",
          background: "#fff",
          color: "#c62828",
          borderRadius: 4,
          padding: "8px 14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
