import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import {
  ACCOUNT_LOGOUT_CALLBACK,
  ACCOUNT_TRIGGER_PX,
  RETIRED_ACCOUNT_LABEL,
  accountMenuClosesOnKey,
  accountPlacement,
  accountRoleKind,
  accountTriggerFits,
  beginPasswordReset,
  buildAccountMenuView,
  desktopNavbarFits,
  desktopNavbarUsedPx,
  isAuthenticatedUser,
  maskEmail,
  requestOwnPasswordReset,
} from "../accountMenuModel";

const navbarSrc = fs.readFileSync(
  path.join(process.cwd(), "app/components/Navbar.js"),
  "utf8"
);
const menuSrc = fs.readFileSync(
  path.join(process.cwd(), "app/components/account/AccountMenu.js"),
  "utf8"
);
const companyAdminsSrc = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/admin/shared/components/CompanyAdminsCard.js"
  ),
  "utf8"
);

describe("account menu visibility", () => {
  it("renders a view for SUPERADMIN", () => {
    const view = buildAccountMenuView({
      user: { email: "root@example.com", role: ROLE.SUPERADMIN, isAdmin: true },
    });
    expect(view).toMatchObject({
      email: "root@example.com",
      role: "superadmin",
      actions: ["resetPassword", "logOut"],
    });
    expect(accountRoleKind(view && { role: ROLE.SUPERADMIN })).toBe(
      "superadmin"
    );
  });

  it("renders a view for ADMIN", () => {
    const view = buildAccountMenuView({
      user: { email: "admin@example.com", role: ROLE.ADMIN, isAdmin: true },
    });
    expect(view.role).toBe("admin");
    expect(view.email).toBe("admin@example.com");
  });

  it("renders a view for other authenticated roles", () => {
    const view = buildAccountMenuView(
      { user: { email: "staff@example.com", role: 0, username: "Sam Staff" } },
      "Harbour Cars"
    );
    expect(isAuthenticatedUser({ user: { email: "staff@example.com" } })).toBe(
      true
    );
    expect(view.role).toBe("staff");
    expect(view.companyName).toBe("Harbour Cars");
    expect(view.initials).toBe("SS");
  });

  it("hides the menu for unauthenticated visitors", () => {
    expect(buildAccountMenuView(null)).toBeNull();
    expect(buildAccountMenuView({})).toBeNull();
    expect(isAuthenticatedUser(null)).toBe(false);
    expect(navbarSrc).toContain("session?.user ?");
  });
});

describe("password reset request", () => {
  it("posts to the session route and does not send a client email", async () => {
    const fetchImpl = jest.fn(async (url, init) => {
      expect(url).toBe("/api/admin/account/send-password-reset");
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
      expect(JSON.stringify(init)).not.toContain("other@evil.com");
      return { ok: true, json: async () => ({ success: true }) };
    });

    await requestOwnPasswordReset(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("ignores a second click while a request is pending", () => {
    const first = beginPasswordReset({ pending: false, error: "" });
    expect(first).toMatchObject({ pending: true, started: true });
    const second = beginPasswordReset({ pending: true, error: "" });
    expect(second.started).toBe(false);
    expect(second.pending).toBe(true);
  });
});

describe("logout and retired controls", () => {
  it("uses the existing home-page signOut callback", () => {
    expect(ACCOUNT_LOGOUT_CALLBACK).toBe("/");
    expect(menuSrc).toContain("signOut({ callbackUrl: ACCOUNT_LOGOUT_CALLBACK })");
    expect(menuSrc).toContain('t("header.logout")');
    expect(menuSrc).not.toContain("resetPasswordEmailMe");
  });

  it("no longer renders the wide reset and logout buttons", () => {
    expect(RETIRED_ACCOUNT_LABEL).toBe("Email me a password reset");
    expect(navbarSrc).not.toContain("SendMyPasswordResetButton");
    expect(navbarSrc).not.toContain("resetPasswordEmailMe");
    expect(navbarSrc).not.toContain('t("header.logout")');
    expect(companyAdminsSrc).not.toContain("SendMyPasswordResetButton");
    expect(fs.existsSync(
      path.join(
        process.cwd(),
        "app/admin/shared/components/SendMyPasswordResetButton.js"
      )
    )).toBe(false);
    expect(menuSrc).toContain('t("header.resetPassword")');
    expect(menuSrc).not.toContain(RETIRED_ACCOUNT_LABEL);
  });
});

describe("keyboard, desktop fit, and mobile drawer", () => {
  it("closes on Escape and keeps an accessible trigger", () => {
    expect(accountMenuClosesOnKey("Escape")).toBe(true);
    expect(accountMenuClosesOnKey("Enter")).toBe(false);
    expect(menuSrc).toContain('aria-label={t("header.account")}');
    expect(menuSrc).toContain("onKeyDown={onMenuKeyDown}");
    expect(menuSrc).toContain("onClose={closeMenu}");
    expect(menuSrc).toContain("<Tooltip");
  });

  it("keeps the desktop bar inside common widths", () => {
    expect(ACCOUNT_TRIGGER_PX).toBeLessThanOrEqual(40);
    expect(accountTriggerFits(1024)).toBe(true);
    expect(desktopNavbarUsedPx()).toBeLessThanOrEqual(900);
    for (const width of [900, 1024, 1280, 1440]) {
      expect(desktopNavbarFits(width)).toBe(true);
    }
    expect(navbarSrc).toContain('display: { xs: "none", md: "inline-flex" }');
    expect(navbarSrc).toContain("height: 32");
  });

  it("puts the same compact account section in the mobile drawer", () => {
    expect(accountPlacement("drawer")).toEqual({
      surface: "drawer",
      compact: true,
    });
    expect(accountPlacement("navbar").surface).toBe("navbar");
    expect(navbarSrc).toContain('placement="drawer"');
    expect(menuSrc).toContain('placement === "drawer"');
    expect(menuSrc).not.toContain('variant="outlined"');
    expect(maskEmail("user@example.com")).toBe("u***@example.com");
  });
});

describe("account menu locales", () => {
  const keys = [
    "account",
    "resetPassword",
    "resetPasswordConfirm",
    "resetPasswordSentShort",
    "resetPasswordError",
    "logout",
    "superadmin",
    "adminRole",
    "staff",
  ];

  it("adds the short account strings to every locale file", () => {
    const dir = path.join(process.cwd(), "locales");
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const header = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf8")
      ).header;
      for (const key of keys) {
        expect(header[key]).toEqual(expect.any(String));
        expect(header[key].length).toBeGreaterThan(0);
      }
      expect(header.resetPassword).not.toMatch(/email me a password reset/i);
      expect(header.resetPasswordConfirm).toContain("{{email}}");
    }
    const en = JSON.parse(
      fs.readFileSync(path.join(dir, "en.json"), "utf8")
    ).header;
    expect(en.account).toBe("Account");
    expect(en.resetPassword).toBe("Reset password");
    expect(en.resetPasswordSentShort).toBe("Password reset email sent.");
    expect(en.resetPasswordError).toBe("Could not send reset email");
    expect(en.logout).toBe("Log out");
    expect(en.staff).toBe("Staff");
  });
});
