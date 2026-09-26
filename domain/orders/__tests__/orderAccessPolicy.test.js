/**
 * Unit tests for orderAccessPolicy
 *
 * ════════════════════════════════════════════════════════════════
 * TEST MATRIX (защита от регрессий)
 * ════════════════════════════════════════════════════════════════
 *
 * | Role       | Order    | Confirmed | Past | canView | canEdit | canDelete | PII |
 * |------------|----------|-----------|------|---------|---------|-----------|-----|
 * | ADMIN      | Client   | ❌        | ❌   | ✅      | ❌      | ✅        | ❌  |
 * | ADMIN      | Client   | ✅        | ❌   | ✅      | ✅*     | ❌        | ✅  |
 * | ADMIN      | Client   | ✅        | ✅   | ✅      | ❌      | ❌        | ✅  |
 * | ADMIN      | Client   | ❌        | ✅   | ✅      | ❌      | ❌        | ❌  |
 * | ADMIN      | Internal | any       | ❌   | ✅      | ✅      | ✅        | ✅  |
 * | ADMIN      | Internal | any       | ✅   | ✅      | ❌      | ❌        | ✅  |
 * | SUPERADMIN | Client   | any       | any  | ✅      | ✅      | ✅        | ✅  |
 * | SUPERADMIN | Internal | any       | any  | ✅      | ❌      | ❌        | ✅  |
 *
 * * edit = только return / insurance
 */

import { getOrderAccess } from "../orderAccessPolicy";

describe("orderAccessPolicy", () => {
  // ════════════════════════════════════════════════════════════════
  // SUPERADMIN TESTS
  // ════════════════════════════════════════════════════════════════

  describe("SUPERADMIN", () => {
    it("has full access to any order", () => {
      const access = getOrderAccess({
        role: "SUPERADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: true,
        timeBucket: "PAST",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(true);
      expect(access.canEditPickupDate).toBe(true);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditReturn).toBe(true);
      expect(access.canEditInsurance).toBe(true);
      expect(access.canEditPricing).toBe(true);
      expect(access.canEditTotalPrice).toBe(true);
      expect(access.canConfirm).toBe(true);
      expect(access.canSeeClientPII).toBe(true);
      expect(access.notifySuperadminOnEdit).toBe(false);
      expect(access.isViewOnly).toBe(false);
    });

    it("can edit internal company bookings without gaining delete access", () => {
      const access = getOrderAccess({
        role: "SUPERADMIN",
        isClientOrder: false,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(false);
      expect(access.canConfirm).toBe(true);
      expect(access.canEditPickupDate).toBe(true);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditPickupPlace).toBe(true);
      expect(access.canEditInsurance).toBe(true);
      expect(access.canEditPricing).toBe(true);
      expect(access.canCorrectMarketplacePrice).toBe(false);
      expect(access.canSeeClientPII).toBe(true);
      expect(access.isViewOnly).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ADMIN + CLIENT ORDER TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ADMIN + Client Order", () => {
    it("UNCONFIRMED + FUTURE: view only, no PII, cannot delete; return fields allowed by field flags", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.canDelete).toBe(false);
      expect(access.canEditPickupDate).toBe(false);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditReturn).toBe(true);
      expect(access.canSeeClientPII).toBe(false); // 🔥 KEY TEST
      expect(access.isViewOnly).toBe(true);
    });

    it("hides client PII from company admin until marketplace fee is paid", () => {
      const unpaid = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
        bookingMode: "MARKETPLACE_REQUEST",
        paymentStatus: "pending",
      });
      expect(unpaid.canSeeClientPII).toBe(false);

      const paid = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
        bookingMode: "MARKETPLACE_REQUEST",
        paymentStatus: "paid",
      });
      expect(paid.canSeeClientPII).toBe(true);
    });

    it("CONFIRMED + FUTURE: limited edit (only return), sees PII, notifies superadmin", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(false); // ❌ can't delete confirmed
      expect(access.canEditPickupDate).toBe(false); // ❌ can't edit dates
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditPickupPlace).toBe(false); // ❌ can't edit placeIn
      expect(access.canEditReturn).toBe(true); // ✅ can edit return only
      expect(access.canEditInsurance).toBe(false); // ❌ client: never insurance
      expect(access.canEditFranchise).toBe(false); // ❌ client: never franchise
      expect(access.canEditPricing).toBe(false); // ❌ can't edit pricing
      expect(access.canSeeClientPII).toBe(true); // 🔥 KEY TEST
      expect(access.notifySuperadminOnEdit).toBe(true); // 🔔 notify
      expect(access.isViewOnly).toBe(false);
    });

    it("CONFIRMED + PAST: view only, sees PII", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: true,
        timeBucket: "PAST",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.canDelete).toBe(false);
      expect(access.canSeeClientPII).toBe(true); // ✅ confirmed = PII visible
      expect(access.isViewOnly).toBe(true);
    });

    it("UNCONFIRMED + PAST: view only, NO PII", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: true,
        timeBucket: "PAST",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.canDelete).toBe(false);
      expect(access.canSeeClientPII).toBe(false); // 🔥 KEY TEST
      expect(access.isViewOnly).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ADMIN + INTERNAL ORDER TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ADMIN + Internal Order", () => {
    it("FUTURE: full edit access", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(true);
      expect(access.canEditPickupDate).toBe(true);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditReturn).toBe(true);
      expect(access.canEditInsurance).toBe(true);
      expect(access.canEditPricing).toBe(true);
      expect(access.canSeeClientPII).toBe(true);
      expect(access.notifySuperadminOnEdit).toBe(false);
      expect(access.isViewOnly).toBe(false);
    });

    it("PAST: editable, sees data", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: false,
        isPast: true,
        timeBucket: "PAST",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(false);
      expect(access.canEditPickupDate).toBe(true);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canSeeClientPII).toBe(true); // internal = always visible
      expect(access.isViewOnly).toBe(false);
    });

    it("CURRENT: all booking fields remain editable", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: false,
        isPast: false,
        timeBucket: "CURRENT",
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canEditPickupDate).toBe(true);
      expect(access.canEditReturnDate).toBe(true);
      expect(access.canEditPickupPlace).toBe(true);
      expect(access.canEditReturn).toBe(true);
      expect(access.canEditInsurance).toBe(true);
      expect(access.canEditFranchise).toBe(true);
      expect(access.canEditPricing).toBe(true);
      expect(access.canEditClientPII).toBe(true);
      expect(access.canConfirm).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ════════════════════════════════════════════════════════════════

  describe("Edge Cases", () => {
    it("always allows viewing (canView is always true)", () => {
      const scenarios = [
        {
          role: "ADMIN",
          isClientOrder: true,
          confirmed: false,
          isPast: true,
          timeBucket: "PAST",
        },
        {
          role: "ADMIN",
          isClientOrder: true,
          confirmed: true,
          isPast: true,
          timeBucket: "PAST",
        },
        {
          role: "ADMIN",
          isClientOrder: false,
          confirmed: false,
          isPast: true,
          timeBucket: "PAST",
        },
        {
          role: "SUPERADMIN",
          isClientOrder: true,
          confirmed: false,
          isPast: true,
          timeBucket: "PAST",
        },
      ];

      scenarios.forEach((ctx) => {
        const access = getOrderAccess(ctx);
        expect(access.canView).toBe(true);
      });
    });

    it("superadmin never notifies superadmin", () => {
      const access = getOrderAccess({
        role: "SUPERADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.notifySuperadminOnEdit).toBe(false);
    });

    it("admin editing confirmed client order notifies superadmin", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.notifySuperadminOnEdit).toBe(true);
    });

    it("throws when timeBucket is missing (CURRENT must exist, no FUTURE fallback)", () => {
      expect(() =>
        getOrderAccess({
          role: "ADMIN",
          isClientOrder: false,
          confirmed: false,
          isPast: false,
          // timeBucket omitted
        })
      ).toThrow("timeBucket is required");
    });
  });
  describe("Manual total price access", () => {
    it("keeps client future orders blocked even when unconfirmed", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canEditPricing).toBe(false);
      expect(access.canEditTotalPrice).toBe(false);
    });

    it("allows all internal price editing for current unconfirmed orders", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: false,
        isPast: false,
        timeBucket: "CURRENT",
      });

      expect(access.canEditPricing).toBe(true);
      expect(access.canEditTotalPrice).toBe(true);
    });

    it("allows price edits for current internal confirmed orders", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: true,
        isPast: false,
        timeBucket: "CURRENT",
      });

      expect(access.canEditPricing).toBe(true);
      expect(access.canEditTotalPrice).toBe(true);
    });

    it("allows manual price updates for future confirmed internal orders", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: false,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
      });

      expect(access.canEditPricing).toBe(true);
      expect(access.canEditTotalPrice).toBe(true);
    });
  });

  describe("Spain marketplace price lock", () => {
    it("never lets rental-company ADMIN change marketplace price", () => {
      const access = getOrderAccess({
        role: "ADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
        bookingMode: "MARKETPLACE_REQUEST",
        partnerConfirmed: false,
        paymentStatus: "",
      });
      expect(access.canEditPricing).toBe(false);
      expect(access.canEditTotalPrice).toBe(false);
      expect(access.canCorrectMarketplacePrice).toBe(false);
    });

    it("locks marketplace price after partner confirmation even for superadmin", () => {
      const access = getOrderAccess({
        role: "SUPERADMIN",
        isClientOrder: true,
        confirmed: false,
        isPast: false,
        timeBucket: "FUTURE",
        bookingMode: "MARKETPLACE_REQUEST",
        partnerConfirmed: true,
        paymentStatus: "pending",
      });
      expect(access.canEditPricing).toBe(false);
      expect(access.canEditTotalPrice).toBe(false);
      expect(access.canCorrectMarketplacePrice).toBe(true);
    });

    it("locks marketplace price after payment", () => {
      const access = getOrderAccess({
        role: "SUPERADMIN",
        isClientOrder: true,
        confirmed: true,
        isPast: false,
        timeBucket: "FUTURE",
        bookingMode: "MARKETPLACE_REQUEST",
        partnerConfirmed: true,
        paymentStatus: "paid",
      });
      expect(access.canEditPricing).toBe(false);
      expect(access.canEditTotalPrice).toBe(false);
      expect(access.canCorrectMarketplacePrice).toBe(true);
    });
  });
});
