/**
 * The licence must be stripped on the server, not hidden by the UI.
 * These tests look at what the API would actually serialise.
 */

import {
  applyVisibilityToOrder,
  applyVisibilityToOrders,
} from "@/domain/orders/orderVisibility";

const COMPANY = "64a000000000000000000001";
const REFERENCE = "carsnk/orders/licence-intake/2026-06/abc123";

const SNAPSHOT = Object.freeze({
  storageReference: REFERENCE,
  storageType: "authenticated",
  checksum: "f".repeat(64),
  uploadedAt: new Date("2026-06-01T09:00:00Z"),
  holderName: "Ana Lopez",
  licenceNumber: "ES1234567",
  issuingCountry: "ES",
  expiryDate: new Date("2030-01-31T00:00:00Z"),
  issueDate: new Date("2015-03-02T00:00:00Z"),
  verificationStatus: "PENDING",
});

function order(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    ownerId: COMPANY,
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    confirmed: false,
    payment: { status: "pending" },
    customerName: "Ana Lopez",
    email: "ana@example.com",
    phone: "+34600000000",
    drivingLicenceSnapshot: { ...SNAPSHOT },
    ...overrides,
  };
}

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const superadmin = { isAdmin: true, role: 2, ownerId: null };

function serialised(result) {
  return JSON.stringify(result);
}

describe("company admin before the verified Booking Fee payment", () => {
  const result = applyVisibilityToOrder(order(), companyAdmin);

  it("receives no licence snapshot at all", () => {
    expect(result.drivingLicenceSnapshot).toBeUndefined();
  });

  it("is not even told that a licence exists", () => {
    expect(result.hasDrivingLicence).toBeUndefined();
  });

  it("receives none of the licence values anywhere in the payload", () => {
    const json = serialised(result);
    expect(json).not.toContain("ES1234567");
    expect(json).not.toContain(REFERENCE);
    expect(json).not.toContain("f".repeat(64));
  });

  it("is refused for a confirmed-but-unpaid booking too", () => {
    const confirmedUnpaid = applyVisibilityToOrder(
      order({ confirmed: true, payment: { status: "pending" } }),
      companyAdmin
    );
    expect(confirmedUnpaid.drivingLicenceSnapshot).toBeUndefined();
  });
});

describe("company admin after the verified Booking Fee payment", () => {
  const result = applyVisibilityToOrder(
    order({ payment: { status: "paid" }, confirmed: true }),
    companyAdmin
  );

  it("may read the licence metadata", () => {
    expect(result.drivingLicenceSnapshot.holderName).toBe("Ana Lopez");
    expect(result.drivingLicenceSnapshot.licenceNumber).toBe("ES1234567");
    expect(result.drivingLicenceSnapshot.verificationStatus).toBe("PENDING");
  });

  it("still never receives the storage reference", () => {
    expect(result.drivingLicenceSnapshot.storageReference).toBeUndefined();
    expect(result.drivingLicenceSnapshot.storageType).toBeUndefined();
    expect(serialised(result)).not.toContain(REFERENCE);
  });

  it("is told a document exists so the UI can offer the download endpoint", () => {
    expect(result.drivingLicenceSnapshot.hasDocument).toBe(true);
    expect(result.hasDrivingLicence).toBe(true);
  });
});

describe("superadmin", () => {
  it("reads the metadata before payment for support and security review", () => {
    const result = applyVisibilityToOrder(order(), superadmin);
    expect(result.drivingLicenceSnapshot.holderName).toBe("Ana Lopez");
  });

  it("does not receive the storage reference either", () => {
    const result = applyVisibilityToOrder(order(), superadmin);
    expect(result.drivingLicenceSnapshot.storageReference).toBeUndefined();
    expect(serialised(result)).not.toContain(REFERENCE);
  });

  it("is unaffected on an order that never had a licence", () => {
    const plain = order({ drivingLicenceSnapshot: undefined });
    expect(applyVisibilityToOrder(plain, superadmin)).toEqual(plain);
  });
});

describe("internal contractor records", () => {
  it("stay readable by the company that created them", () => {
    const internal = order({
      source: "INTERNAL",
      my_order: false,
      offline: true,
      confirmed: true,
      payment: null,
      drivingLicenceSnapshot: undefined,
    });
    const result = applyVisibilityToOrder(internal, companyAdmin);
    expect(result.customerName).toBe("Ana Lopez");
    expect(result.email).toBe("ana@example.com");
  });
});

describe("legacy orders without a licence", () => {
  it("do not crash and report no licence", () => {
    for (const snapshot of [undefined, null, {}]) {
      const result = applyVisibilityToOrder(
        order({ payment: { status: "paid" }, drivingLicenceSnapshot: snapshot }),
        companyAdmin
      );
      expect(result.drivingLicenceSnapshot).toBeUndefined();
      expect(result.hasDrivingLicence).toBeUndefined();
    }
  });
});

describe("lists are stripped the same way as single orders", () => {
  it("strips every row before payment", () => {
    const rows = applyVisibilityToOrders([order(), order()], companyAdmin);
    for (const row of rows) {
      expect(row.drivingLicenceSnapshot).toBeUndefined();
    }
    expect(serialised(rows)).not.toContain("ES1234567");
  });
});
