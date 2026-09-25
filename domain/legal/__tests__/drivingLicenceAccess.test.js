import {
  canViewDrivingLicenceDocuments,
  evaluateDrivingLicenceAccess,
  isPastRetention,
  issuedUrlIsPermanent,
  signedDocumentDelivery,
  ACCESS_WINDOW_BEFORE_PICKUP_HOURS,
  ACCESS_WINDOW_AFTER_RETURN_HOURS,
  SIGNED_URL_TTL_SECONDS,
} from "@/domain/legal/drivingLicenceAccess";

const HOUR = 3600 * 1000;
const NOW = new Date("2026-06-10T12:00:00Z");
const OWNER = "507f1f77bcf86cd799439011";
const OTHER_OWNER = "507f1f77bcf86cd799439012";

function order(overrides = {}) {
  return {
    ownerId: OWNER,
    confirmed: true,
    payment: { status: "paid" },
    pickupAtUtc: new Date(NOW.getTime() + 24 * HOUR),
    returnAtUtc: new Date(NOW.getTime() + 120 * HOUR),
    ...overrides,
  };
}

function evaluate(overrides = {}, sessionOverrides = {}) {
  return evaluateDrivingLicenceAccess({
    order: order(overrides),
    isSuperadmin: false,
    sessionOwnerId: OWNER,
    now: NOW,
    ...sessionOverrides,
  });
}

describe("who may see a driving licence", () => {
  it("lets the owning fleet see it near an active booking", () => {
    expect(evaluate().allowed).toBe(true);
  });

  it("gives another fleet a generic not-found, not a 403 that confirms the booking", () => {
    const result = evaluate({}, { sessionOwnerId: OTHER_OWNER });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("not_found");
    expect(result.status).toBe(404);
    // Indistinguishable from a booking id that does not exist at all.
    const missing = evaluateDrivingLicenceAccess({
      order: null,
      isSuperadmin: false,
      sessionOwnerId: OTHER_OWNER,
    });
    expect(result.status).toBe(missing.status);
    expect(result.code).toBe(missing.code);
    expect(result.message).toBe(missing.message);
  });

  it("refuses a session with no fleet at all", () => {
    const result = evaluate({}, { sessionOwnerId: null });
    expect(result.code).toBe("not_found");
    expect(result.status).toBe(404);
  });

  it("lets superadmin through for dispute handling", () => {
    const result = evaluateDrivingLicenceAccess({
      order: order({ confirmed: false, payment: null }),
      isSuperadmin: true,
      sessionOwnerId: null,
      now: NOW,
    });
    expect(result.allowed).toBe(true);
  });

  it("returns 404 rather than leaking whether an order exists", () => {
    const result = evaluateDrivingLicenceAccess({
      order: null,
      isSuperadmin: false,
      sessionOwnerId: OWNER,
    });
    expect(result.status).toBe(404);
  });
});

describe("lawful stage", () => {
  it("refuses an unpaid, unconfirmed request", () => {
    const result = evaluate({ confirmed: false, payment: { status: "pending" } });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("not_yet_lawful");
  });

  it("refuses a confirmed booking until the Booking Fee webhook marks it paid", () => {
    const result = evaluate({ confirmed: true, payment: { status: "pending" } });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("not_yet_lawful");
  });

  it("allows the licence after the Booking Fee is paid, even well before pickup", () => {
    expect(
      evaluate({
        payment: { status: "paid" },
        pickupAtUtc: new Date(
          NOW.getTime() + (ACCESS_WINDOW_BEFORE_PICKUP_HOURS + 24) * HOUR
        ),
      }).allowed
    ).toBe(true);
  });
});

describe("access window", () => {
  it("refuses long after the return", () => {
    const result = evaluate({
      pickupAtUtc: new Date(NOW.getTime() - 500 * HOUR),
      returnAtUtc: new Date(
        NOW.getTime() - (ACCESS_WINDOW_AFTER_RETURN_HOURS + 24) * HOUR
      ),
    });
    expect(result.code).toBe("window_closed");
  });

  it("still allows access shortly after the return for disputes", () => {
    const result = evaluate({
      pickupAtUtc: new Date(NOW.getTime() - 500 * HOUR),
      returnAtUtc: new Date(NOW.getTime() - 1 * HOUR),
    });
    expect(result.allowed).toBe(true);
  });
});

describe("signed URL lifetime", () => {
  it("is measured in minutes, not hours", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300);
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThan(0);
  });

  it("asks for a signed expiring URL and rejects the stored URL", () => {
    const delivery = signedDocumentDelivery(NOW);
    expect(delivery.options.sign_url).toBe(true);
    expect(delivery.options.expires_at).toBe(
      Math.floor(NOW.getTime() / 1000) + SIGNED_URL_TTL_SECONDS
    );
    const stored = "https://res.cloudinary.com/demo/image/upload/licence.jpg";
    expect(issuedUrlIsPermanent(stored, stored)).toBe(true);
    expect(
      issuedUrlIsPermanent(stored, `${stored}?signature=abc&expires_at=1`)
    ).toBe(false);
  });
});

describe("automatic deletion", () => {
  it("keeps documents inside the retention period", () => {
    expect(
      isPastRetention({
        order: order({ returnAtUtc: new Date(NOW.getTime() - 10 * 24 * HOUR) }),
        retentionDays: 90,
        now: NOW,
      })
    ).toBe(false);
  });

  it("marks documents past the retention period for deletion", () => {
    expect(
      isPastRetention({
        order: order({ returnAtUtc: new Date(NOW.getTime() - 100 * 24 * HOUR) }),
        retentionDays: 90,
        now: NOW,
      })
    ).toBe(true);
  });

  it("honours a shorter configured retention", () => {
    expect(
      isPastRetention({
        order: order({ returnAtUtc: new Date(NOW.getTime() - 40 * 24 * HOUR) }),
        retentionDays: 30,
        now: NOW,
      })
    ).toBe(true);
  });
});
