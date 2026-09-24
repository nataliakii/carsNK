/**
 * Navbar badges + bell menu read ONE `/api/admin/inbox/pending` response.
 */
import { buildCompanySetupTasks } from "@/domain/legal/companySetupTasks";
import { adminInboxBadges, adminInboxGroups } from "../inboxView";
import { sumPendingInbox } from "../pendingInbox";

function serverResponse({ rentals = 0, transfers = 0, setup = {} } = {}) {
  return sumPendingInbox({
    rentals,
    transfers,
    companySetupTasks: buildCompanySetupTasks(setup),
  });
}

const TERMS_READY = {
  verificationStatus: "VERIFIED",
  termsPublication: "READY_TO_ACCEPT",
};

describe("admin inbox view", () => {
  it("1-3, 16. one response feeds the Orders badge, the legal badge and the bell", () => {
    const response = serverResponse({ rentals: 3, setup: TERMS_READY });

    const navbar = adminInboxBadges(response);
    const bell = adminInboxBadges(response);

    expect(navbar.orders).toBe(3);
    expect(navbar.companySetup).toBe(1);
    expect(bell.bell).toBe(4);
    expect(navbar).toEqual(bell);
    expect(navbar.orders).not.toBe(bell.bell);
  });

  it("2. the Orders badge never reuses the bell total", () => {
    const badges = adminInboxBadges(
      serverResponse({ rentals: 3, setup: TERMS_READY })
    );
    expect(badges.orders).toBe(3);
    expect(badges.bell).toBe(4);
  });

  it("3. the legal badge disappears when there is no actionable task", () => {
    const badges = adminInboxBadges(
      serverResponse({
        rentals: 3,
        setup: { verificationStatus: "VERIFIED", termsPublication: "ACCEPTED" },
      })
    );
    expect(badges.companySetup).toBe(0);
    expect(badges.bell).toBe(3);
  });

  it("17. recomputing from a refreshed response updates every badge", () => {
    const before = adminInboxBadges(
      serverResponse({ rentals: 3, setup: TERMS_READY })
    );
    const after = adminInboxBadges(
      serverResponse({
        rentals: 3,
        setup: { verificationStatus: "VERIFIED", termsPublication: "ACCEPTED" },
      })
    );
    expect([before.orders, before.companySetup, before.bell]).toEqual([3, 1, 4]);
    expect([after.orders, after.companySetup, after.bell]).toEqual([3, 0, 3]);
  });

  it("18. every bell item deep-links to the exact screen, never a dashboard", () => {
    const groups = adminInboxGroups(
      serverResponse({ rentals: 3, setup: TERMS_READY })
    );
    const [bookings, companySetup] = groups;

    expect(bookings.id).toBe("bookings");
    expect(bookings.count).toBe(3);
    expect(bookings.items.map((item) => item.href)).toEqual([
      "/admin/orders",
      "/admin/orders?tab=transfers",
    ]);

    expect(companySetup.id).toBe("companySetup");
    expect(companySetup.count).toBe(1);
    expect(companySetup.items[0]).toMatchObject({
      id: "TERMS_READY_TO_ACCEPT",
      href: "/admin/company/setup?step=terms",
    });
    for (const item of groups.flatMap((group) => group.items)) {
      expect(item.href).not.toBe("/admin");
      expect(item.href).toBeTruthy();
    }
  });

  it("deep-links document and details tasks to their own step", () => {
    const groups = adminInboxGroups(
      serverResponse({
        setup: {
          verificationStatus: "REJECTED",
          documents: [
            { label: "Insurance", accepted: false, reviewedAt: "2026-09-01" },
          ],
        },
      })
    );
    const hrefs = groups[1].items.map((item) => item.href);
    expect(hrefs).toEqual([
      "/admin/company/setup?step=details",
      "/admin/company/setup?step=documents",
    ]);
  });

  it("hides the company setup group for a platform superadmin", () => {
    const groups = adminInboxGroups(serverResponse({ rentals: 3 }), {
      includeCompanySetup: false,
    });
    expect(groups.map((group) => group.id)).toEqual(["bookings"]);
  });

  it("falls back to local math when the response predates the shared total", () => {
    const badges = adminInboxBadges({ rentals: 2, transfers: 3 });
    expect(badges).toEqual({ orders: 2, companySetup: 0, bell: 5 });
  });
});
