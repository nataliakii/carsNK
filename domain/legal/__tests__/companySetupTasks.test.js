import fs from "fs";
import path from "path";

import { buildCompanySetupTasks } from "../companySetupTasks";
import { sumPendingInbox } from "@/domain/orders/pendingInbox";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("company setup inbox tasks", () => {
  it("1-3. Three booking tasks and one terms task split badges", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "VERIFIED",
      termsPublication: "READY_TO_ACCEPT",
    });
    const inbox = sumPendingInbox({
      rentals: 3,
      transfers: 0,
      companySetupTasks: tasks,
    });
    expect(inbox.total).toBe(4);
    expect(inbox.ordersBadge).toBe(3);
    expect(inbox.companySetup.count).toBe(1);
    expect(inbox.ordersBadge).not.toBe(inbox.total);
  });

  it("4. Unpublished terms produce no task", () => {
    expect(
      buildCompanySetupTasks({
        verificationStatus: "VERIFIED",
        termsPublication: "NOT_PUBLISHED",
      })
    ).toEqual([]);
  });

  it("5-6. Published unaccepted terms are one task even with three package documents", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "VERIFIED",
      termsPublication: "READY_TO_ACCEPT",
      packageDocumentCount: 3,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TERMS_READY_TO_ACCEPT");
    expect(tasks[0].href).toBe("/admin/company/setup?step=details");
  });

  it("7. Updated terms produce one task", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "VERIFIED",
      termsPublication: "UPDATE_REQUIRED",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TERMS_UPDATE_REQUIRED");
  });

  it("8. Accepted current terms produce no task", () => {
    expect(
      buildCompanySetupTasks({
        verificationStatus: "VERIFIED",
        termsPublication: "ACCEPTED",
      })
    ).toEqual([]);
  });

  it("9. Requested document changes produce one task", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "DRAFT",
      termsPublication: "NOT_PUBLISHED",
      documents: [
        { label: "Insurance", accepted: false, reviewedAt: "2026-09-01" },
        { label: "Registration", accepted: false, reviewedAt: "2026-09-01" },
      ],
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("DOCUMENT_CHANGES_REQUESTED");
    expect(tasks[0].description).toContain("Insurance");
    expect(tasks[0].href).toBe("/admin/company/setup?step=documents");
  });

  it("10. Under-review documents produce no task", () => {
    expect(
      buildCompanySetupTasks({
        verificationStatus: "PENDING_VERIFICATION",
        termsPublication: "NOT_PUBLISHED",
        documents: [{ label: "Insurance", accepted: false, reviewedAt: "2026-09-01" }],
      })
    ).toEqual([]);
  });

  it("11. Opening a task does not clear it", () => {
    const pending = {
      verificationStatus: "VERIFIED",
      termsPublication: "READY_TO_ACCEPT",
    };
    const baseline = buildCompanySetupTasks(pending);
    // Only the underlying legal state clears a task; UI read-state cannot.
    for (const hint of ["opened", "seen", "dismissed", "read", "visitedAt"]) {
      expect(buildCompanySetupTasks({ ...pending, [hint]: true })).toEqual(
        baseline
      );
    }
    const route = read("app/api/admin/inbox/pending/route.js");
    expect(route).not.toMatch(/dismiss|markRead|seenAt|acknowledg/i);
  });

  it("12. Completing a task removes it and decrements the bell", () => {
    const before = sumPendingInbox({
      rentals: 3,
      transfers: 0,
      companySetupTasks: buildCompanySetupTasks({
        verificationStatus: "VERIFIED",
        termsPublication: "READY_TO_ACCEPT",
      }),
    });
    const after = sumPendingInbox({
      rentals: 3,
      transfers: 0,
      companySetupTasks: buildCompanySetupTasks({
        verificationStatus: "VERIFIED",
        termsPublication: "ACCEPTED",
      }),
    });
    expect(before.total).toBe(4);
    expect(after.ordersBadge).toBe(3);
    expect(after.companySetup.count).toBe(0);
    expect(after.total).toBe(3);
  });

  it("13-14. Inbox uses the signed-in company, not a query company id", () => {
    const route = read("app/api/admin/inbox/pending/route.js");
    expect(route).toContain("getSessionOwnerId(session.user)");
    expect(route).toContain("getEffectiveOwnerId(session.user)");
    expect(route).not.toContain('searchParams.get("companyId")');
  });

  it("15. Greece booking counts stay rentals for orders and rentals+transfers for the bell", () => {
    const inbox = sumPendingInbox({ rentals: 2, transfers: 3 });
    expect(inbox.ordersBadge).toBe(2);
    expect(inbox.notificationsBadge).toBe(5);
    expect(inbox.total).toBe(5);
  });

  it("16. Navbar and bell derive their badges from the same hook and view helper", () => {
    const nav = read("app/components/Navbar.js");
    const bell = read("app/admin/shared/components/AdminPendingInboxBell.js");
    for (const source of [nav, bell]) {
      expect(source).toContain("useAdminPendingInbox");
      expect(source).toContain("adminInboxBadges");
    }
    expect(bell).toContain("adminInboxGroups");
    expect(read("domain/legal/companySetupTasks.js")).toContain(
      'companySetupHref("details")'
    );
  });

  it("17. every success path invalidates the shared inbox without reloading", () => {
    const hook = read("app/hooks/useAdminPendingInbox.js");
    expect(hook).toContain(
      'window.addEventListener("rovaro-inbox-refresh", onRefresh)'
    );
    const successPaths = [
      // terms accepted / updated terms accepted
      "app/admin/company/legal/CompanyTermsPanel.js",
      // requested company changes resubmitted
      "app/admin/legal-profile/PartnerLegalProfileSection.js",
      // requested document changes resubmitted
      "app/admin/legal-profile/_components/PartnerDocumentsCard.js",
    ];
    for (const file of successPaths) {
      const source = read(file);
      expect(source).toContain(
        'window.dispatchEvent(new Event("rovaro-inbox-refresh"))'
      );
      expect(source).not.toContain("window.location.reload");
    }
  });

  it("published terms are not a task before the company can accept them", () => {
    for (const status of ["DRAFT", "PENDING_VERIFICATION", "REJECTED", "SUSPENDED"]) {
      const ids = buildCompanySetupTasks({
        verificationStatus: status,
        termsPublication: "READY_TO_ACCEPT",
      }).map((task) => task.id);
      expect(ids).not.toContain("TERMS_READY_TO_ACCEPT");
    }
  });

  it("suspended company without an available action has no task", () => {
    expect(
      buildCompanySetupTasks({
        verificationStatus: "SUSPENDED",
        termsPublication: "UPDATE_REQUIRED",
      })
    ).toEqual([]);
  });

  it("tasks never expose internal review data", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "REJECTED",
      termsPublication: "NOT_PUBLISHED",
      documents: [
        {
          kind: "insurance_certificate",
          accepted: false,
          reviewedAt: "2026-09-01",
          note: "internal: blurry scan",
          storageRef: "partner/abc",
          reviewedByEmail: "admin@example.com",
        },
      ],
    });
    const text = JSON.stringify(tasks);
    expect(text).toContain("Insurance certificate");
    expect(text).not.toMatch(/blurry|partner\/abc|admin@example|checksum/i);
  });

  it("custom agreement inside the terms package is a single task", () => {
    const tasks = buildCompanySetupTasks({
      verificationStatus: "VERIFIED",
      termsPublication: "READY_TO_ACCEPT",
      hasCustomAgreement: true,
    });
    expect(tasks.map((task) => task.id)).toEqual(["CUSTOM_AGREEMENT_READY"]);
  });
});
