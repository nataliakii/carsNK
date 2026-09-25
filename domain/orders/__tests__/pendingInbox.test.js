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
import mongoose from "mongoose";

const SUPER = { user: { isAdmin: true, role: ROLE.SUPERADMIN } };
const ES_OWNER = new mongoose.Types.ObjectId();
const GR_OWNER = new mongoose.Types.ObjectId();

describe("pendingInbox", () => {
  it("sums counts and exposes separate orders vs notifications badges", () => {
    expect(sumPendingInbox({ rentals: 2, transfers: 3 })).toMatchObject({
      rentals: 2,
      transfers: 3,
      ordersBadge: 2,
      notificationsBadge: 5,
      total: 5,
      companySetup: { count: 0, tasks: [] },
    });
  });

  it("does not copy orders badge onto notifications badge when transfers exist", () => {
    const counts = sumPendingInbox({ rentals: 10, transfers: 0 });
    expect(counts.ordersBadge).toBe(10);
    expect(counts.notificationsBadge).toBe(10);
    const withTransfers = sumPendingInbox({ rentals: 10, transfers: 2 });
    expect(withTransfers.ordersBadge).toBe(10);
    expect(withTransfers.notificationsBadge).toBe(12);
    expect(withTransfers.ordersBadge).not.toBe(withTransfers.notificationsBadge);
  });

  it("builds rental filter for partner admin", () => {
    const filter = buildPendingRentalsFilter({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: "507f1f77bcf86cd799439011" },
    });
    expect(filter.confirmed).toBeUndefined();
    expect(filter.$and).toBeTruthy();
    expect(JSON.stringify(filter)).not.toContain("PAYMENT_PROCESSING");
    expect(JSON.stringify(filter)).toContain("PENDING_SUPPLIER_CONFIRMATION");
    expect(filter.ownerId).toBeTruthy();
  });

  it("Spain workspace rentals filter excludes Greek owners", () => {
    const filter = buildPendingRentalsFilter(SUPER, "ES", {
      ownerIds: [ES_OWNER],
    });
    expect(filter.ownerId).toEqual({ $in: [ES_OWNER] });
    expect(String(filter.ownerId.$in[0])).not.toBe(String(GR_OWNER));
  });

  it("Greece workspace rentals filter uses GR owners only", () => {
    const filter = buildPendingRentalsFilter(SUPER, "GR", {
      ownerIds: [GR_OWNER],
    });
    expect(filter.ownerId).toEqual({ $in: [GR_OWNER] });
  });

  it("Spain workspace with no ES companies matches nothing", () => {
    const filter = buildPendingRentalsFilter(SUPER, "ES", { ownerIds: [] });
    expect(filter._id).toBeNull();
  });

  it("ALL workspace does not restrict by ownerIds", () => {
    const filter = buildPendingRentalsFilter(SUPER, "ALL", {
      ownerIds: null,
    });
    expect(filter.ownerId).toBeUndefined();
    expect(filter.countryCode).toBeUndefined();
  });

  it("sync fallback scopes ES by countryCode when ownerIds omitted", () => {
    const filter = buildPendingRentalsFilter(SUPER, "ES");
    expect(filter.countryCode).toBe("ES");
  });

  it("includes quote-required statuses for transfers", () => {
    expect(TRANSFER_PENDING_ATTENTION_STATUSES).toContain(
      "MANUAL_QUOTE_REQUIRED"
    );
    expect(TRANSFER_PENDING_ATTENTION_STATUSES).toContain("OPEN_FOR_CLAIM");
  });

  it("builds transfer filter for superadmin with country", () => {
    const filter = buildPendingTransfersFilter(SUPER, "ES");
    expect(filter.$and).toBeTruthy();
    expect(filter.$and[0].country).toBe("ES");
  });
});
