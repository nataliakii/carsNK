import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  countCompanyRentalActions,
  orderRequiresCompanyAction,
  PROBLEM_ASSIGNEE,
} from "@/domain/orders/companyRentalActions";
import { contractorRentalActionBadge } from "@/domain/orders/inboxView";
import fs from "fs";
import path from "path";

function platform(overrides = {}) {
  return {
    source: "PLATFORM",
    my_order: true,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    confirmed: false,
    ...overrides,
  };
}

describe("company rental action badge", () => {
  it("counts one new platform request", () => {
    expect(countCompanyRentalActions([platform()])).toBe(1);
  });

  it("ignores internal rows", () => {
    expect(
      orderRequiresCompanyAction({
        source: "INTERNAL",
        my_order: false,
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      })
    ).toBe(false);
  });

  it("ignores awaiting payment and payment expired", () => {
    expect(
      orderRequiresCompanyAction(
        platform({ bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING })
      )
    ).toBe(false);
    expect(
      orderRequiresCompanyAction(platform({ bookingStatus: BOOKING_STATUS.PAYMENT_EXPIRED }))
    ).toBe(false);
  });

  it("drops the count as soon as the supplier responds", () => {
    const before = countCompanyRentalActions([platform()]);
    const after = countCompanyRentalActions([
      platform({
        bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
        supplierResponse: "CONFIRMED",
      }),
    ]);
    expect(before).toBe(1);
    expect(after).toBe(0);
  });

  it("counts a problem only when it is assigned to the supplier", () => {
    const reported = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      hasProblem: true,
    });
    expect(orderRequiresCompanyAction(reported)).toBe(false);
    expect(
      orderRequiresCompanyAction({
        ...reported,
        problemAssignedTo: PROBLEM_ASSIGNEE.SUPPLIER,
      })
    ).toBe(true);
    expect(
      orderRequiresCompanyAction({
        ...reported,
        problemAssignedTo: PROBLEM_ASSIGNEE.ROVARO,
      })
    ).toBe(false);
  });

  it("uses one number for the navbar and the Car rentals tab", () => {
    const inbox = { rentals: 1, ordersBadge: 1, transfers: 4, total: 9 };
    expect(contractorRentalActionBadge(inbox)).toBe(1);
    const root = process.cwd();
    const navbar = fs.readFileSync(path.join(root, "app/components/Navbar.js"), "utf8");
    const hub = fs.readFileSync(
      path.join(root, "app/admin/features/orders/OrdersHubSection.js"),
      "utf8"
    );
    expect(navbar).toContain("contractorRentalActionBadge");
    expect(hub).toContain("contractorRentalActionBadge");
  });
});
