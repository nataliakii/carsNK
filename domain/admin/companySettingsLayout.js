/**
 * Shared layout tokens for the Company admin hub (/admin/company).
 * All tabs share one outer shell so switching tabs does not jump width/edges.
 */

export const COMPANY_SETTINGS_PATH = "/admin/company";

/** Navbar AppBar height — sticky tabs sit under it on desktop. */
export const COMPANY_SETTINGS_NAVBAR_HEIGHT_PX = 64;

export const COMPANY_SETTINGS_SHELL = Object.freeze({
  width: "100%",
  maxWidth: 1440,
  /** padding-inline: mobile 16 / tablet 24 / desktop 32 */
  paddingInline: Object.freeze({ xs: 2, sm: 3, md: 4 }),
});

export const COMPANY_SETTINGS_TAB_CONTENT = Object.freeze({
  marginTop: 2, // 16px
  /** padding: mobile 16 / tablet 24 / desktop 32 */
  padding: Object.freeze({ xs: 2, sm: 3, md: 4 }),
  borderRadius: 2,
  background: "#ffffff",
});

export const COMPANY_SETTINGS_TAB_BAR = Object.freeze({
  desktopPosition: "sticky",
  top: `${COMPANY_SETTINGS_NAVBAR_HEIGHT_PX}px`,
  zIndex: 20,
  background: "#ffffff",
  borderBottom: "1px solid",
  /** Magenta active indicator + text (brand primary). */
  indicatorColor: "#E9004F",
  /** 24px horizontal padding on the tab row */
  paddingInline: 3,
  /** 12px gap between tabs */
  gap: 1.5,
  tabWhiteSpace: "nowrap",
  tabMinHeight: 48,
  /** Content-width tabs — no stretch / no active background pill */
  tabMinWidth: "auto",
  tabHorizontalPadding: 1.5,
});

/** Responsive form grid shared by company hub forms. */
export const COMPANY_SETTINGS_FORM_GRID = Object.freeze({
  display: "grid",
  /** Desktop 2 cols; tablet + mobile 1 col */
  gridTemplateColumns: Object.freeze({ xs: "1fr", md: "1fr 1fr" }),
  /** 20px mobile/tablet, 24px desktop */
  gap: Object.freeze({ xs: 2.5, md: 3 }),
  alignItems: "start",
  width: "100%",
});
