/**
 * @jest-environment node
 */

import {
  buildPendingRentalsFilter,
  buildPendingTransfersFilter,
  sumPendingInbox,
  TRANSFER_PENDING_ATTENTION_STATUSES,
} from "@/domain/orders/pendingInbox";
import { ROLE } from "@/domain/orders/admin-rbac";

describe("pendingInbox", () => {
  it("sums counts", () => {
    expect(sumPendingInbox({ rentals: 2, transfers: 3 })).toEqual({
      rentals: 2,
      transfers: 3,
      total: 5,
    });
  });

  it("builds rental filter for partner admin", () => {
    const filter = buildPendingRentalsFilter({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: "507f1f77bcf86cd799439011" },
    });
    expect(filter.confirmed).toEqual({ $ne: true });
    expect(filter.ownerId).toBeTruthy();
  });

  it("includes quote-required statuses for transfers", () => {
    expect(TRANSFER_PENDING_ATTENTION_STATUSES).toContain(
      "MANUAL_QUOTE_REQUIRED"
    );
    expect(TRANSFER_PENDING_ATTENTION_STATUSES).toContain("OPEN_FOR_CLAIM");
  });

  it("builds transfer filter for superadmin with country", () => {
    const filter = buildPendingTransfersFilter(
      { user: { isAdmin: true, role: ROLE.SUPERADMIN } },
      "ES"
    );
    expect(filter.$and).toBeTruthy();
  });
});
