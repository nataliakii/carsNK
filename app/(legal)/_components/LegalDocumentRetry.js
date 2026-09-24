"use client";

/**
 * Friendly public error for legal pages. Technical details stay server-side.
 */
export default function LegalDocumentRetry({
  message = "We could not load this page right now. Please try again.",
}) {
  return (
    <div
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "24px 20px 48px",
      }}
    >
      <div
        style={{
          padding: 16,
          backgroundColor: "#ffebee",
          borderRadius: 4,
          color: "#c62828",
        }}
      >
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
    </div>
  );
}
