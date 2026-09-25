/**
 * @jest-environment node
 *
 * What the public catalog is allowed to promise, and what the server must
 * still enforce after the customer clicks BOOK. The client calendar is a
 * convenience; it is never the availability or price authority.
 */

import fs from "node:fs";
import path from "node:path";
import { BOOKING_STATUS } from "../bookingStatus";
import { BOOKING_MODES } from "../bookingMode";
import { resolveRentalBookingContext } from "../resolveRentalContext";
import {
  resolveCompanyRentalPaymentPolicy,
  shouldChargeRentalOnCreate,
} from "@/domain/orders/companyRentalPaymentPolicy";
import { buildBookingDraft, BOOKING_MODE } from "../publicBookingMode";

const ROUTE = path.join(process.cwd(), "app/api/order/add/route.js");

function readRoute() {
  return fs.readFileSync(ROUTE, "utf8");
}

describe("public booking request creation", () => {
  test("a new marketplace request waits for the supplier", () => {
    const context = resolveRentalBookingContext({
      order: { bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST },
      company: { country: "ES" },
      forNewOrder: true,
    });
    expect(context.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(context.initialBookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
  });

  test("no payment is taken while creating the request", () => {
    const policy = resolveCompanyRentalPaymentPolicy(
      { useStripe: true, rentalPaymentTiming: "before_confirm" },
      { stripeConfigured: true, bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST }
    );
    expect(
      shouldChargeRentalOnCreate(policy, {
        bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
        isClientOrder: true,
      })
    ).toBe(false);
  });

  test("the server revalidates availability rather than trusting the calendar", () => {
    const route = readRoute();
    expect(route).toContain("evaluateRentalAvailability");
    expect(route).toContain("@/domain/booking/availabilityEngine");
  });

  test("the driving licence requirement on public creation stays intact", () => {
    const route = readRoute();
    expect(route).toContain("drivingLicenceRequiredForCreate");
  });

  test("an immutable financial snapshot is written for platform requests", () => {
    const route = readRoute();
    expect(route).toContain("bookingFinancialSnapshotFromQuote");
    expect(route).toContain("generatePublicBookingReference");
  });
});

describe("booking draft handed to the modal", () => {
  test("it names one car, that car's dates and that car's quote", () => {
    const draft = buildBookingDraft({
      sourceMode: BOOKING_MODE.CAR_FIRST,
      carId: "car-a",
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      quoteId: "car-a|2026-10-20|2026-10-24||",
    });
    expect(draft.carId).toBe("car-a");
    expect(draft.quoteId).toContain("car-a");
  });

  test("a draft can never be assembled from a half-finished selection", () => {
    expect(
      buildBookingDraft({
        sourceMode: BOOKING_MODE.CAR_FIRST,
        carId: "car-a",
        startDate: "2026-10-20",
        endDate: null,
      })
    ).toBeNull();
  });
});

describe("customer-facing fee copy", () => {
  test("the booking fee is resolved per company, never hardcoded as 10%", () => {
    const fee = fs.readFileSync(
      path.join(process.cwd(), "domain/orders/marketplaceBookingFee.js"),
      "utf8"
    );
    // The percentage is contractual and varies per company.
    expect(fee).toContain("DEFAULT_MARKETPLACE_BOOKING_FEE_BPS");
    expect(fee).toContain("MAX_MARKETPLACE_BOOKING_FEE_BPS");

    const panelFiles = [
      "app/components/CarComponent/CarBookingPanel.js",
      "app/components/ui/booking/BookingCtaPanel.js",
      "domain/booking/carBookingPanel.js",
    ];
    panelFiles.forEach((file) => {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text).not.toMatch(/\b10\s?%/);
      expect(text).not.toMatch(/\b30\s?%/);
    });
  });
});

describe("public catalog never scrolls or rewrites the URL on a date click", () => {
  const files = [
    "app/components/CarComponent/CalendarPicker.js",
    "app/components/CarComponent/CarBookingPanel.js",
    "app/components/ui/booking/BookingCtaPanel.js",
    "app/hooks/useCarCalendar.js",
    "app/hooks/useSearchFirstQuote.js",
  ];

  test("no scrollIntoView, window.scrollTo or history rewrite remains", () => {
    files.forEach((file) => {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      // Call sites, not prose: the surrounding comments name these APIs.
      expect(text).not.toMatch(/\.scrollIntoView\s*\(/);
      expect(text).not.toMatch(/window\.scrollTo\s*\(/);
      expect(text).not.toMatch(/\.replaceState\s*\(/);
    });
  });

  test("the booking panel no longer writes the catalog's global search dates", () => {
    const panel = fs.readFileSync(
      path.join(process.cwd(), "app/components/CarComponent/CarBookingPanel.js"),
      "utf8"
    );
    // This single call is what copied one car's range into every other card.
    expect(panel).not.toMatch(/setSearchDates\s*\(/);
  });
});
