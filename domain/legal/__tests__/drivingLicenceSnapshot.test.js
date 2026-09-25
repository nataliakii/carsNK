import {
  DRIVING_LICENCE_VERIFICATION,
  LICENCE_CAPTURE_CODE,
  assertDrivingLicenceSnapshotUnchanged,
  applyDrivingLicenceVerification,
  hasDrivingLicenceSnapshot,
  licenceCaptureMessageKey,
  redactDrivingLicenceSnapshot,
  validateDrivingLicenceCapture,
  validateDrivingLicenceFields,
} from "@/domain/legal/drivingLicenceSnapshot";

const NOW = new Date("2026-06-10T12:00:00Z");
const PICKUP = new Date("2026-07-01T10:00:00Z");
const RETURN = new Date("2026-07-08T10:00:00Z");
const CHECKSUM = "a".repeat(64);

function payload(overrides = {}) {
  return {
    holderName: "Ana Lopez",
    licenceNumber: "ES-1234567",
    issuingCountry: "es",
    expiryDate: "2030-01-31",
    issueDate: "2015-03-02",
    ...overrides,
  };
}

function upload(overrides = {}) {
  return {
    storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
    checksum: CHECKSUM,
    uploadedAt: NOW,
    storageType: "authenticated",
    ...overrides,
  };
}

function capture(payloadOverrides = {}, uploadOverrides = {}) {
  return validateDrivingLicenceCapture({
    payload: payload(payloadOverrides),
    upload: upload(uploadOverrides),
    pickupAtUtc: PICKUP,
    returnAtUtc: RETURN,
    now: NOW,
  });
}

describe("capturing a driving licence", () => {
  it("stores all nine required snapshot fields", () => {
    const result = capture();
    expect(result.ok).toBe(true);
    expect(result.snapshot).toEqual(
      expect.objectContaining({
        storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
        checksum: CHECKSUM,
        uploadedAt: NOW,
        holderName: "Ana Lopez",
        licenceNumber: "ES-1234567",
        issuingCountry: "ES",
        verificationStatus: DRIVING_LICENCE_VERIFICATION.PENDING,
      })
    );
    expect(result.snapshot.expiryDate).toBeInstanceOf(Date);
    expect(result.snapshot.issueDate).toBeInstanceOf(Date);
  });

  it("normalises the issuing country and the licence number", () => {
    const result = capture({ issuingCountry: " de ", licenceNumber: "de 998 877/x" });
    expect(result.snapshot.issuingCountry).toBe("DE");
    expect(result.snapshot.licenceNumber).toBe("DE998877X");
  });

  it("starts every capture as pending review, never as verified", () => {
    const result = capture({ verificationStatus: "VERIFIED" });
    expect(result.snapshot.verificationStatus).toBe(
      DRIVING_LICENCE_VERIFICATION.PENDING
    );
  });
});

describe("photo-only public checkout (typed fields optional)", () => {
  it("stores the verified upload without typed metadata", () => {
    const result = validateDrivingLicenceCapture({
      payload: { uploadReceipt: "opaque" },
      upload: upload(),
      requireTypedFields: false,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot.holderName).toBe("");
    expect(result.snapshot.licenceNumber).toBe("");
    expect(result.snapshot.expiryDate).toBeNull();
  });
});

describe("refusing an incomplete capture", () => {
  it.each([
    ["holderName", { holderName: " " }, LICENCE_CAPTURE_CODE.HOLDER_NAME_REQUIRED],
    ["licenceNumber", { licenceNumber: "ab" }, LICENCE_CAPTURE_CODE.NUMBER_REQUIRED],
    ["issuingCountry", { issuingCountry: "" }, LICENCE_CAPTURE_CODE.COUNTRY_REQUIRED],
    ["expiryDate", { expiryDate: "" }, LICENCE_CAPTURE_CODE.EXPIRY_REQUIRED],
    ["issueDate", { issueDate: "" }, LICENCE_CAPTURE_CODE.ISSUE_DATE_REQUIRED],
  ])("refuses a missing %s", (field, overrides, code) => {
    const result = capture(overrides);
    expect(result.ok).toBe(false);
    expect(result.code).toBe(code);
    expect(result.field).toBe(field);
    expect(result.messageKey).toBe(licenceCaptureMessageKey(code));
    expect(result.message).toBeTruthy();
  });

  it("refuses an empty payload outright", () => {
    const result = validateDrivingLicenceCapture({ payload: null, upload: upload() });
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.REQUIRED);
  });
});

describe("expiry against the rental dates", () => {
  it("refuses a licence that expires before the return", () => {
    const result = capture({ expiryDate: "2026-07-01" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.EXPIRES_BEFORE_RETURN);
    expect(result.field).toBe("expiryDate");
  });

  it("accepts a licence that expires on the return day itself", () => {
    expect(capture({ expiryDate: "2026-07-08" }).ok).toBe(true);
  });

  it("accepts a licence already expiring after the return, even if soon", () => {
    expect(capture({ expiryDate: "2026-07-09" }).ok).toBe(true);
  });

  it("refuses an issue date in the future or after the expiry", () => {
    expect(capture({ issueDate: "2027-01-01" }).code).toBe(
      LICENCE_CAPTURE_CODE.ISSUE_DATE_INVALID
    );
    expect(capture({ issueDate: "2031-01-01", expiryDate: "2030-01-31" }).code).toBe(
      LICENCE_CAPTURE_CODE.ISSUE_DATE_INVALID
    );
  });
});

describe("the upload half of the rules", () => {
  it("refuses a capture with no upload at all", () => {
    const result = validateDrivingLicenceCapture({
      payload: payload(),
      upload: null,
      returnAtUtc: RETURN,
      now: NOW,
    });
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_MISSING);
  });

  it("refuses an upload with no storage reference", () => {
    expect(capture({}, { storageReference: "" }).code).toBe(
      LICENCE_CAPTURE_CODE.UPLOAD_MISSING
    );
  });

  it("treats a malformed checksum as a failed upload, not a valid one", () => {
    expect(capture({}, { checksum: "not-a-sha256" }).code).toBe(
      LICENCE_CAPTURE_CODE.UPLOAD_FAILED
    );
    expect(capture({}, { checksum: "" }).code).toBe(
      LICENCE_CAPTURE_CODE.UPLOAD_FAILED
    );
  });

  it("refuses an upload with no timestamp", () => {
    expect(capture({}, { uploadedAt: "nonsense" }).code).toBe(
      LICENCE_CAPTURE_CODE.UPLOAD_FAILED
    );
  });

  it("reports a field typo before asking for a re-upload", () => {
    const result = validateDrivingLicenceCapture({
      payload: payload({ licenceNumber: "" }),
      upload: null,
      returnAtUtc: RETURN,
      now: NOW,
    });
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.NUMBER_REQUIRED);
  });
});

describe("the form mirror shares the server rules", () => {
  it("gives the same refusal the server would give, in the same order", () => {
    for (const overrides of [
      { holderName: "" },
      { licenceNumber: "x" },
      { issuingCountry: "" },
      { expiryDate: "" },
      { expiryDate: "2026-07-01" },
      { issueDate: "" },
    ]) {
      const form = validateDrivingLicenceFields({
        payload: payload(overrides),
        pickupAtUtc: PICKUP,
        returnAtUtc: RETURN,
        now: NOW,
      });
      const server = capture(overrides);
      expect(form.ok).toBe(false);
      expect(form.code).toBe(server.code);
      expect(form.field).toBe(server.field);
    }
  });

  it("passes the fields but cannot admit a booking on its own", () => {
    const form = validateDrivingLicenceFields({
      payload: payload(),
      pickupAtUtc: PICKUP,
      returnAtUtc: RETURN,
      now: NOW,
    });
    expect(form.ok).toBe(true);
    expect(form.snapshot).toBeUndefined();
  });
});

describe("serialising a snapshot", () => {
  it("never exposes the storage reference, even to a permitted caller", () => {
    const view = redactDrivingLicenceSnapshot(capture().snapshot);
    expect(view.storageReference).toBeUndefined();
    expect(view.storageType).toBeUndefined();
    expect(view.hasDocument).toBe(true);
    expect(view.holderName).toBe("Ana Lopez");
    expect(JSON.stringify(view)).not.toContain("licence-intake");
  });

  it("returns null when nothing was captured", () => {
    expect(redactDrivingLicenceSnapshot(null)).toBeNull();
    expect(redactDrivingLicenceSnapshot(undefined)).toBeNull();
  });

  it("reports hasDocument false for a snapshot whose document was purged", () => {
    const view = redactDrivingLicenceSnapshot({
      ...capture().snapshot,
      storageReference: "",
    });
    expect(view.hasDocument).toBe(false);
  });
});

describe("the snapshot is a captured record, not a mutable field", () => {
  const snapshot = capture().snapshot;

  it("recognises a real capture", () => {
    expect(hasDrivingLicenceSnapshot({ drivingLicenceSnapshot: snapshot })).toBe(true);
    expect(hasDrivingLicenceSnapshot({})).toBe(false);
    expect(hasDrivingLicenceSnapshot(null)).toBe(false);
  });

  it("refuses a later rewrite of the document", () => {
    const result = assertDrivingLicenceSnapshotUnchanged(snapshot, {
      ...snapshot,
      storageReference: "somewhere/else",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DRIVING_LICENCE_SNAPSHOT_IMMUTABLE");
  });

  it("refuses a swapped checksum for the same reference", () => {
    expect(
      assertDrivingLicenceSnapshotUnchanged(snapshot, {
        ...snapshot,
        checksum: "b".repeat(64),
      }).ok
    ).toBe(false);
  });

  it("allows an untouched update and a first capture", () => {
    expect(assertDrivingLicenceSnapshotUnchanged(snapshot, undefined).ok).toBe(true);
    expect(assertDrivingLicenceSnapshotUnchanged(snapshot, { ...snapshot }).ok).toBe(
      true
    );
    expect(assertDrivingLicenceSnapshotUnchanged(null, snapshot).ok).toBe(true);
  });

  it("lets a reviewer move only the verification status", () => {
    expect(
      applyDrivingLicenceVerification(snapshot, DRIVING_LICENCE_VERIFICATION.VERIFIED)
    ).toEqual({ ok: true, verificationStatus: "VERIFIED" });
    expect(applyDrivingLicenceVerification(snapshot, "BOOKING_CONFIRMED").ok).toBe(
      false
    );
    expect(
      applyDrivingLicenceVerification(null, DRIVING_LICENCE_VERIFICATION.VERIFIED).code
    ).toBe("DRIVING_LICENCE_SNAPSHOT_MISSING");
  });
});
