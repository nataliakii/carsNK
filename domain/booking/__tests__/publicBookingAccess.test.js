/**
 * @jest-environment node
 */
import {
  PUBLIC_REFERENCE_ALPHABET,
  generatePublicBookingReference,
  isValidPublicBookingReference,
} from "../publicBookingReference";
import {
  createCustomerBookingAccess,
  resetCustomerBookingAccessRateLimit,
  revokeCustomerBookingAccess,
  rotateCustomerBookingAccess,
  verifyCustomerBookingAccess,
} from "../customerBookingAccess";
import { loadPublicBookingPage } from "../publicBookingView";
import { buildBookingFinancialSnapshot } from "@/domain/orders/bookingFinancialSnapshot";

const MONGO_ID = "6ab65fce36f96a68058125cd";
const ORDER_NUMBER = "20260925134903";
const STRIPE_REF = "pi_3UJY122KmkWc8VQH0QOL0";

function paidOrder(access) {
  const snap = buildBookingFinancialSnapshot({ grossMinor: 16500, feeBps: 1000 });
  return {
    _id: MONGO_ID,
    orderNumber: ORDER_NUMBER,
    publicReference: "RVR-7K4P9",
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: "BOOKING_CONFIRMED",
    carModel: "Seat Leon",
    email: "customer@example.com",
    phone: "+34600000000",
    customerBookingAccess: access,
    bookingFinancialSnapshot: snap,
    payment: {
      status: "paid",
      paymentIntentId: STRIPE_REF,
      providerPaymentId: "cs_test_secret",
    },
    bookingFeePaymentStatus: "PAID",
    placeIn: "Barcelona airport",
    placeOut: "Barcelona airport",
    pickupAtUtc: "2026-10-01T10:00:00.000Z",
    returnAtUtc: "2026-10-05T10:00:00.000Z",
    locationSnapshot: {
      pickup: { instructions: "Desk 4, terminal 1" },
    },
    supplierNotes: "internal only",
  };
}

describe("public booking reference", () => {
  test("is RVR- plus five unambiguous characters", () => {
    expect(PUBLIC_REFERENCE_ALPHABET).not.toMatch(/[O0I1]/);
    for (let i = 0; i < 40; i += 1) {
      const ref = generatePublicBookingReference();
      expect(isValidPublicBookingReference(ref)).toBe(true);
      expect(ref).toMatch(/^RVR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
      expect(ref).not.toContain(MONGO_ID);
    }
    expect(isValidPublicBookingReference("RVR-O0001")).toBe(false);
    expect(isValidPublicBookingReference("RVR-I1111")).toBe(false);
    expect(isValidPublicBookingReference(ORDER_NUMBER)).toBe(false);
    expect(isValidPublicBookingReference(MONGO_ID)).toBe(false);
  });
});

describe("public booking page access", () => {
  beforeEach(() => {
    resetCustomerBookingAccessRateLimit();
  });

  test("a valid token opens the booking without an account and hides internal fields", async () => {
    const issued = createCustomerBookingAccess();
    const order = paidOrder(issued.access);
    const logs = [];
    const spy = jest.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const view = await loadPublicBookingPage({
      publicReference: order.publicReference,
      accessToken: issued.token,
      ip: "203.0.113.10",
      locale: "en",
      findOrder: async (reference) =>
        reference === order.publicReference ? order : null,
      findCompany: async () => ({
        name: "Test Spanish Company",
        email: "desk@example.com",
        meetingContactPhone: "+34930000000",
      }),
    });
    spy.mockRestore();
    expect(view).toBeTruthy();
    expect(view.readOnly).toBe(true);
    expect(view.publicReference).toBe("RVR-7K4P9");
    expect(view.statusLabel).toBe("Booking confirmed");
    expect(view.statusLabel).not.toBe("BOOKING_CONFIRMED");
    expect(view.vehicleName).toBe("Seat Leon");
    expect(view.total).toBe("€165.00");
    expect(view.bookingFee).toBe("€16.50");
    expect(view.supplierBalance).toBe("€148.50");
    expect(view.supplierName).toBe("Test Spanish Company");
    expect(view.supplierPhone).toBe("+34930000000");
    expect(view.supplierEmail).toBe("desk@example.com");
    expect(view.collectionInstructions).toBe("Desk 4, terminal 1");
    expect(view.rovaroTermsLabel).toBe("Rovaro Booking Terms");
    expect(view.cancellationNote).toMatch(/booking reference/i);
    const blob = JSON.stringify(view);
    expect(blob).not.toContain(MONGO_ID);
    expect(blob).not.toContain(ORDER_NUMBER);
    expect(blob).not.toContain(STRIPE_REF);
    expect(blob).not.toContain("cs_test_secret");
    expect(blob).not.toContain("BOOKING_CONFIRMED");
    expect(blob).not.toContain(issued.token);
    expect(blob).not.toContain("supplierNotes");
    expect(logs.join("\n")).not.toContain(issued.token);
    expect(verifyCustomerBookingAccess(issued.access, issued.token).ok).toBe(true);
  });

  test("invalid, revoked, and rotated tokens reveal nothing", async () => {
    const issued = createCustomerBookingAccess();
    const order = paidOrder(issued.access);
    const findOrder = async () => order;
    const findCompany = async () => ({ name: "Hidden Co", email: "hidden@example.com" });

    const invalid = await loadPublicBookingPage({
      publicReference: "RVR-7K4P9",
      accessToken: "not-the-token",
      ip: "203.0.113.11",
      findOrder,
      findCompany,
    });
    expect(invalid).toBeNull();

    const revokedAccess = revokeCustomerBookingAccess(issued.access);
    const revoked = await loadPublicBookingPage({
      publicReference: "RVR-7K4P9",
      accessToken: issued.token,
      ip: "203.0.113.12",
      findOrder: async () => paidOrder(revokedAccess),
      findCompany,
    });
    expect(revoked).toBeNull();

    const rotated = rotateCustomerBookingAccess(issued.access);
    const oldToken = await loadPublicBookingPage({
      publicReference: "RVR-7K4P9",
      accessToken: issued.token,
      ip: "203.0.113.13",
      findOrder: async () => paidOrder(rotated.access),
      findCompany,
    });
    expect(oldToken).toBeNull();
    const fresh = await loadPublicBookingPage({
      publicReference: "RVR-7K4P9",
      accessToken: rotated.token,
      ip: "203.0.113.14",
      findOrder: async () => paidOrder(rotated.access),
      findCompany,
    });
    expect(fresh?.publicReference).toBe("RVR-7K4P9");
    expect(fresh?.readOnly).toBe(true);
  });

  test("too many invalid attempts reveal nothing, including a later valid token", async () => {
    const issued = createCustomerBookingAccess();
    const order = paidOrder(issued.access);
    const args = {
      publicReference: "RVR-7K4P9",
      ip: "203.0.113.20",
      findOrder: async () => order,
      findCompany: async () => ({ name: "Test Spanish Company" }),
    };
    for (let i = 0; i < 9; i += 1) {
      const denied = await loadPublicBookingPage({
        ...args,
        accessToken: `wrong-${i}`,
      });
      expect(denied).toBeNull();
    }
    const blocked = await loadPublicBookingPage({
      ...args,
      accessToken: issued.token,
    });
    expect(blocked).toBeNull();
  });
});
