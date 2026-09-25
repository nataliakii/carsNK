/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  destinationAfterLogin,
  loginUrlForReturn,
  safeInternalReturnPath,
} from "@/domain/admin/adminReturnTo";
import {
  resolveOrdersModalTarget,
  searchWithoutOrderId,
  searchWithOrderId,
  supplierActionEffects,
} from "@/domain/admin/ordersModalQuery";
import { supplierCanReadOrder } from "@/domain/admin/supplierOrderAccess";
import { PLATFORM_WORKFLOW_STAGE } from "@/domain/admin/rovaroContractorAdmin";
import {
  countCompanyRentalActions,
  orderRequiresCompanyAction,
} from "@/domain/orders/companyRentalActions";
import { contractorRentalActionBadge } from "@/domain/orders/inboxView";
import { supplierBookingReviewUrl } from "@/domain/mail/supplierNewBookingEmail";

const COMPANY = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";
const ORDER_ID = "64a0000000000000000000aa";

const companyUser = {
  isAdmin: true,
  role: 1,
  ownerId: COMPANY,
};

function platform(overrides = {}) {
  return {
    _id: ORDER_ID,
    source: "PLATFORM",
    my_order: true,
    ownerId: COMPANY,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    confirmed: false,
    ...overrides,
  };
}

describe("login returnTo", () => {
  const orderPath = `/admin/orders?status=new&source=platform&orderId=${ORDER_ID}`;

  test("unauthenticated admin link round-trips through login to the order", () => {
    const login = loginUrlForReturn(orderPath);
    expect(login.startsWith("/login?returnTo=")).toBe(true);
    const returnTo = new URL(`https://rovaro.autos${login}`).searchParams.get("returnTo");
    expect(destinationAfterLogin(returnTo)).toBe(orderPath);
  });

  test("rejects absolute, protocol-relative, and off-site redirects", () => {
    expect(safeInternalReturnPath("https://evil.example/admin/orders?orderId=1")).toBeNull();
    expect(safeInternalReturnPath("http://rovaro.autos/admin/orders?orderId=1")).toBeNull();
    expect(safeInternalReturnPath("//evil.example/admin/orders")).toBeNull();
    expect(safeInternalReturnPath("/\\evil.example")).toBeNull();
    expect(safeInternalReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeInternalReturnPath("https:evil.example")).toBeNull();
    expect(destinationAfterLogin("https://evil.example")).toBe("/admin");
    expect(safeInternalReturnPath(orderPath)).toBe(orderPath);

    const root = path.join(__dirname, "../../..");
    const layout = fs.readFileSync(path.join(root, "app/admin/AdminLayoutClient.js"), "utf8");
    const login = fs.readFileSync(path.join(root, "app/components/Login/Login.js"), "utf8");
    expect(layout).toContain("loginUrlForReturn");
    expect(login).toContain("destinationAfterLogin");
  });
});

describe("live order modal", () => {
  test("authenticated supplier opens EditOrderModal for the current server stage", () => {
    const href = supplierBookingReviewUrl(ORDER_ID);
    const url = new URL(href);
    expect(url.pathname).toBe("/admin/orders");
    expect([...url.searchParams.keys()]).toEqual(["orderId"]);
    expect(url.searchParams.get("orderId")).toBe(ORDER_ID);

    const waiting = resolveOrdersModalTarget({
      orderId: url.searchParams.get("orderId"),
      order: platform(),
      access: supplierCanReadOrder(companyUser, platform()),
    });
    expect(waiting.open).toBe(true);
    expect(waiting.modal).toBe("EditOrderModal");
    expect(waiting.stage).toBe(PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION);
    expect(waiting.supplierActions).toBe(true);
    expect(waiting.refreshInbox).toBeUndefined();

    const confirmed = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      confirmed: true,
      payment: { status: "paid" },
    });
    const later = resolveOrdersModalTarget({
      orderId: ORDER_ID,
      order: confirmed,
      access: supplierCanReadOrder(companyUser, confirmed),
    });
    expect(later.stage).toBe(PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED);
    expect(later.supplierActions).toBe(false);
  });

  test("another company cannot access the order", () => {
    const access = supplierCanReadOrder(
      { isAdmin: true, role: 1, ownerId: OTHER },
      platform()
    );
    expect(access.ok).toBe(false);
    expect(access.status).toBe(404);
    const target = resolveOrdersModalTarget({
      orderId: ORDER_ID,
      order: platform(),
      access,
    });
    expect(target.open).toBe(false);
    expect(target.notFound).toBe(true);
  });

  test("closing the modal removes only orderId", () => {
    const opened = searchWithOrderId("status=new&source=platform", ORDER_ID);
    const params = new URLSearchParams(opened);
    expect(params.get("status")).toBe("new");
    expect(params.get("source")).toBe("platform");
    expect(params.get("orderId")).toBe(ORDER_ID);
    expect(params.get("token")).toBeNull();
    expect(params.get("action")).toBeNull();
    const closed = new URLSearchParams(searchWithoutOrderId(opened));
    expect(closed.get("orderId")).toBeNull();
    expect(closed.get("status")).toBe("new");
    expect(closed.get("source")).toBe("platform");
  });

  test("a supplier action updates the row and both action badges", () => {
    const before = [platform()];
    expect(orderRequiresCompanyAction(before[0])).toBe(true);
    expect(countCompanyRentalActions(before)).toBe(1);
    const inboxBefore = { ordersBadge: 1, rentals: 1 };
    expect(contractorRentalActionBadge(inboxBefore)).toBe(1);

    const fresh = platform({ bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING });
    const effects = supplierActionEffects(before, ORDER_ID, fresh);
    expect(effects.keepModalOpen).toBe(true);
    expect(effects.refreshInbox).toBe(true);
    expect(orderRequiresCompanyAction(effects.orders[0])).toBe(false);
    expect(effects.selectedOrder.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
    const inboxAfter = {
      ordersBadge: countCompanyRentalActions(effects.orders),
      rentals: countCompanyRentalActions(effects.orders),
    };
    expect(contractorRentalActionBadge(inboxAfter)).toBe(0);

    const root = path.join(__dirname, "../../..");
    const navbar = fs.readFileSync(path.join(root, "app/components/Navbar.js"), "utf8");
    const hub = fs.readFileSync(
      path.join(root, "app/admin/features/orders/OrdersHubSection.js"),
      "utf8"
    );
    const table = fs.readFileSync(
      path.join(root, "app/admin/features/orders/OrdersTableSection.js"),
      "utf8"
    );
    expect(navbar).toContain("contractorRentalActionBadge");
    expect(hub).toContain("contractorRentalActionBadge");
    expect(table).toContain('new Event("rovaro-inbox-refresh")');
    expect(table).toContain("EditOrderModal");
    expect(table).toContain("window.location.search");
    expect(table).not.toContain("partner-confirm");
    const openEffect = table.slice(table.indexOf("if (!orderIdQuery)"));
    const refreshAt = table.indexOf("const refreshOrderAfterSupplierAction");
    const effectAt = table.indexOf("if (!orderIdQuery)");
    expect(refreshAt).toBeGreaterThan(-1);
    expect(effectAt).toBeGreaterThan(refreshAt);
    expect(openEffect).not.toContain("rovaro-inbox-refresh");
  });
});
