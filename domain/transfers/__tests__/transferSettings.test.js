/**
 * @jest-environment node
 */
import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";
import {
  assertCanEditTransferPayments,
  defaultUseRentalFleetForForm,
  mergeTransferServices,
  resolveAcceptAllTransferRequests,
  resolveTransferCoverageFollowsCompany,
  resolveTransferNotifyEmail,
  resolveTransferServiceArea,
  resolveUseRentalFleet,
} from "../transferSettings";
import { partnerNotifyEmails } from "../eligibility";

describe("transfer settings defaults and compatibility", () => {
  const saved = {
    enabled: true,
    maxPassengers: 4,
    vehicleCategories: ["STANDARD"],
    serviceCities: ["malaga"],
    airportsServed: ["AGP"],
    childSeatsAvailable: 2,
    contactEmails: ["ops@old.test"],
    payments: { stripeForPlatformFee: true, stripeForCompanyAmount: false },
  };

  test("unset flags keep existing companies on saved filters", () => {
    expect(resolveUseRentalFleet(saved)).toBe(false);
    expect(resolveAcceptAllTransferRequests(saved)).toBe(false);
    expect(resolveTransferCoverageFollowsCompany(saved)).toBe(false);
    expect(defaultUseRentalFleetForForm(saved, true)).toBe(true);
    expect(defaultUseRentalFleetForForm({ useRentalFleet: false }, true)).toBe(
      false
    );
  });

  test("merge does not wipe saved filters when omitted", () => {
    const merged = mergeTransferServices(saved, {
      enabled: true,
      useRentalFleet: true,
      acceptAllTransferRequests: true,
    });
    expect(merged.maxPassengers).toBe(4);
    expect(merged.vehicleCategories).toEqual(["STANDARD"]);
    expect(merged.serviceCities).toEqual(["malaga"]);
    expect(merged.airportsServed).toEqual(["AGP"]);
    expect(merged.childSeatsAvailable).toBe(2);
    expect(merged.contactEmails).toEqual(["ops@old.test"]);
    expect(merged.payments).toEqual(saved.payments);
    expect(merged.useRentalFleet).toBe(true);
  });

  test("coverage follows company when no transfer-specific area is saved", () => {
    const company = {
      email: "desk@partner.test",
      deliveryPricing: { operatingCities: ["Marbella", "Malaga"] },
      offices: [
        { name: "Malaga Airport", locationType: "airport", iataCode: "AGP" },
      ],
      transferServices: { enabled: true },
    };
    expect(resolveTransferCoverageFollowsCompany(company.transferServices)).toBe(
      true
    );
    expect(resolveTransferServiceArea(company)).toEqual({
      serviceCities: ["Marbella", "Malaga"],
      airportsServed: ["AGP", "Malaga Airport"],
      communityCodes: [],
      provinceCodes: [],
      radiusKm: null,
    });
  });

  test("notify email defaults to company email unless overridden", () => {
    const company = {
      email: "desk@partner.test",
      transferServices: {},
    };
    expect(resolveTransferNotifyEmail(company)).toBe("desk@partner.test");
    expect(
      resolveTransferNotifyEmail({
        ...company,
        transferServices: { transferNotifyEmail: "transfers@partner.test" },
      })
    ).toBe("transfers@partner.test");
    expect(partnerNotifyEmails(company)).toEqual(["desk@partner.test"]);
    expect(
      partnerNotifyEmails({
        ...company,
        transferServices: { transferNotifyEmail: "transfers@partner.test" },
      })
    ).toEqual(["transfers@partner.test"]);
  });

  test("company mode cannot edit payment flags", () => {
    const forbidden = assertCanEditTransferPayments(ADMIN_VIEW_MODE.COMPANY, {
      payments: { stripeForPlatformFee: true },
    });
    expect(forbidden.ok).toBe(false);
    expect(forbidden.status).toBe(403);

    const viewAs = assertCanEditTransferPayments(ADMIN_VIEW_MODE.COMPANY, {
      payments: { stripeForCompanyAmount: true },
    });
    expect(viewAs.status).toBe(403);

    const allowed = assertCanEditTransferPayments(
      ADMIN_VIEW_MODE.PLATFORM_ADMIN,
      { payments: { stripeForPlatformFee: true } }
    );
    expect(allowed.ok).toBe(true);

    const untouched = mergeTransferServices(
      saved,
      { payments: { stripeForPlatformFee: false, stripeForCompanyAmount: true } },
      { canEditPayments: false }
    );
    expect(untouched.payments).toEqual(saved.payments);
  });
});
