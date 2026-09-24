/**
 * Shared layout tokens for public customer legal pages
 * (Terms, Privacy, Cookies — and their aliases).
 *
 * Matches the rest of the public Rovaro site: one MainContainer so status,
 * title, body, fee table, and footer notes share the same left/right edges.
 */

export const PUBLIC_LEGAL_MAIN_CONTAINER = Object.freeze({
  width: "100%",
  maxWidth: 1400,
  marginInline: "auto",
  boxSizing: "border-box",
  /** padding-inline: mobile 16 / tablet 24 / desktop 32 */
  paddingInline: Object.freeze({ xs: 2, sm: 3, md: 4 }),
  /** Consistent vertical rhythm under the public navbar */
  paddingTop: Object.freeze({ xs: 3, md: 4 }),
  paddingBottom: Object.freeze({ xs: 6, md: 8 }),
});

export const PUBLIC_LEGAL_STATUS_BOX = Object.freeze({
  padding: 16,
  borderRadius: 4,
});

export const PUBLIC_LEGAL_STATUS_PREPARING = Object.freeze({
  ...PUBLIC_LEGAL_STATUS_BOX,
  backgroundColor: "#fff3e0",
  color: "#e65100",
});

export const PUBLIC_LEGAL_STATUS_ERROR = Object.freeze({
  ...PUBLIC_LEGAL_STATUS_BOX,
  backgroundColor: "#ffebee",
  color: "#c62828",
});
