process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import { LICENCE_CAPTURE_CODE } from "@/domain/legal/drivingLicenceSnapshot";
import {
  clientDrivingLicenceReadyForCreate,
  drivingLicenceRequiredForCreate,
  resolveDrivingLicenceForCreate,
} from "@/domain/legal/drivingLicenceCreateGate";
import {
  UPLOAD_RECEIPT_TTL_MS,
  createUploadReceipt,
} from "@/domain/legal/drivingLicenceUploadReceipt";

const NOW = new Date("2026-06-10T12:00:00Z");
const PICKUP = new Date("2026-07-01T10:00:00Z");
const RETURN = new Date("2026-07-08T10:00:00Z");

function receipt(now = NOW, contentType = "image/jpeg") {
  const minted = createUploadReceipt({
    storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
    storageType: "authenticated",
    checksum: "d".repeat(64),
    uploadedAt: now,
    byteSize: 1024,
    contentType,
  });
  return minted.receipt;
}

function payload(overrides = {}) {
  return {
    holderName: "Ana Lopez",
    licenceNumber: "ES-1234567",
    issuingCountry: "ES",
    expiryDate: "2030-01-31",
    issueDate: "2015-03-02",
    uploadReceipt: receipt(),
    ...overrides,
  };
}

function resolve(overrides = {}) {
  return resolveDrivingLicenceForCreate({
    isAdminSession: false,
    bookingSource: BOOKING_SOURCE.PLATFORM,
    payload: payload(),
    pickupAtUtc: PICKUP,
    returnAtUtc: RETURN,
    now: NOW,
    ...overrides,
  });
}

describe("who the requirement applies to", () => {
  it("applies to a new public PLATFORM request", () => {
    expect(
      drivingLicenceRequiredForCreate({
        isAdminSession: false,
        bookingSource: BOOKING_SOURCE.PLATFORM,
      })
    ).toBe(true);
  });

  it("does not apply to an INTERNAL contractor record", () => {
    expect(
      drivingLicenceRequiredForCreate({
        isAdminSession: false,
        bookingSource: BOOKING_SOURCE.INTERNAL,
      })
    ).toBe(false);
  });

  it("does not apply to a booking an admin creates in the console", () => {
    expect(
      drivingLicenceRequiredForCreate({
        isAdminSession: true,
        bookingSource: BOOKING_SOURCE.PLATFORM,
      })
    ).toBe(false);
  });

  it("leaves an INTERNAL create untouched even with no licence payload at all", () => {
    const result = resolveDrivingLicenceForCreate({
      isAdminSession: false,
      bookingSource: BOOKING_SOURCE.INTERNAL,
      payload: null,
    });
    expect(result).toEqual({ ok: true, required: false, snapshot: undefined });
  });

  it("leaves an admin create untouched even with no licence payload at all", () => {
    const result = resolveDrivingLicenceForCreate({
      isAdminSession: true,
      bookingSource: BOOKING_SOURCE.PLATFORM,
      payload: null,
    });
    expect(result.ok).toBe(true);
    expect(result.required).toBe(false);
    expect(result.snapshot).toBeUndefined();
  });
});

describe("a public PLATFORM request without a licence", () => {
  it("is rejected when nothing was sent", () => {
    const result = resolve({ payload: null });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.REQUIRED);
    expect(result.messageKey).toBe("order.licenceRequired");
  });

  it("is rejected when the licence data is there but the upload is not", () => {
    const result = resolve({ payload: payload({ uploadReceipt: "" }) });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_MISSING);
    expect(result.field).toBe("document");
  });

  it("accepts photo-only capture without typed licence fields", () => {
    const result = resolve({
      payload: {
        uploadReceipt: receipt(),
      },
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot).toEqual(
      expect.objectContaining({
        storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
        holderName: "",
        licenceNumber: "",
        issuingCountry: "",
      })
    );
  });
});

describe("a failed upload cannot be talked into a booking", () => {
  it("rejects a forged upload descriptor supplied directly by the client", () => {
    // The old shape: client-provided `upload`. It must carry no weight at all.
    const result = resolve({
      payload: payload({
        uploadReceipt: "",
        upload: {
          storageReference: "carsnk/orders/anything",
          checksum: "e".repeat(64),
          uploadedAt: NOW,
        },
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_MISSING);
  });

  it("rejects a tampered receipt as a failed upload", () => {
    const valid = receipt();
    const [version, body] = valid.split(".");
    const result = resolve({
      payload: payload({ uploadReceipt: `${version}.${body}.forged-signature` }),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_FAILED);
  });

  it("rejects a receipt replayed long after the upload", () => {
    const stale = receipt(new Date(NOW.getTime() - UPLOAD_RECEIPT_TTL_MS - 1000));
    const result = resolve({ payload: payload({ uploadReceipt: stale }) });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(LICENCE_CAPTURE_CODE.UPLOAD_FAILED);
    expect(result.receiptCode).toBe("RECEIPT_EXPIRED");
  });

  it("tells the customer the same thing whether the receipt was forged or expired", () => {
    const forged = resolve({
      payload: payload({ uploadReceipt: "v1.abc.def" }),
    });
    const expired = resolve({
      payload: payload({
        uploadReceipt: receipt(new Date(NOW.getTime() - UPLOAD_RECEIPT_TTL_MS - 1)),
      }),
    });
    expect(forged.messageKey).toBe(expired.messageKey);
    expect(forged.message).toBe(expired.message);
  });
});

describe("clientDrivingLicenceReadyForCreate", () => {
  it("is not ready until the upload receipt is present", () => {
    expect(
      clientDrivingLicenceReadyForCreate({
        payload: payload({ uploadReceipt: "" }),
      }).code
    ).toBe(LICENCE_CAPTURE_CODE.UPLOAD_MISSING);

    expect(
      clientDrivingLicenceReadyForCreate({
        payload: { uploadReceipt: receipt() },
      })
    ).toEqual({ ok: true });
  });

  it("rejects a missing payload", () => {
    expect(clientDrivingLicenceReadyForCreate({ payload: null }).code).toBe(
      LICENCE_CAPTURE_CODE.REQUIRED
    );
  });
});

describe("a complete public request", () => {
  it("produces the snapshot the order will store", () => {
    const result = resolve();
    expect(result.ok).toBe(true);
    expect(result.required).toBe(true);
    expect(result.snapshot).toEqual(
      expect.objectContaining({
        storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
        checksum: "d".repeat(64),
        holderName: "Ana Lopez",
        issuingCountry: "ES",
        verificationStatus: "PENDING",
      })
    );
  });

  it("records the resource type storage will need to deliver the file", () => {
    // An image and a PDF scan live under different Cloudinary resource types.
    // Getting this wrong means the admin download fails for PDF licences.
    expect(resolve().snapshot.resourceType).toBe("image");

    const asPdf = resolve({
      payload: payload({ uploadReceipt: receipt(NOW, "application/pdf") }),
    });
    expect(asPdf.ok).toBe(true);
    expect(asPdf.snapshot.resourceType).toBe("raw");
  });

  it("takes the resource type from the signed receipt, not the request body", () => {
    // A client claiming "image" for a PDF must not change where we look.
    const spoofed = resolve({
      payload: {
        ...payload({ uploadReceipt: receipt(NOW, "application/pdf") }),
        resourceType: "image",
        upload: { resourceType: "image" },
      },
    });
    expect(spoofed.snapshot.resourceType).toBe("raw");
  });
});
