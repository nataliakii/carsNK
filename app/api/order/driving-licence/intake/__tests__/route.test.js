/**
 * @jest-environment node
 */

process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

const uploadStreamEnd = jest.fn();
let uploadOutcome = {
  result: { public_id: "carsnk/orders/licence-intake/2026-06/abc123", type: "authenticated" },
  error: null,
};
let capturedUploadOptions = null;

jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: {
    uploader: {
      upload_stream: jest.fn((options, callback) => {
        capturedUploadOptions = options;
        return {
          end: (buffer) => {
            uploadStreamEnd(buffer);
            callback(uploadOutcome.error, uploadOutcome.result);
          },
        };
      }),
    },
  },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn(async () => true),
  extractAuditContext: jest.fn(() => ({ ipAddress: "203.0.113.5", userAgent: "jest" })),
}));

import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { resetLicenceUploadRateLimit } from "@/domain/legal/drivingLicenceIntake";
import { verifyUploadReceipt } from "@/domain/legal/drivingLicenceUploadReceipt";
import { POST } from "../route";

const BYTES = "pretend-licence-image-bytes";

function upload({ type = "image/jpeg", content = BYTES, name = "licence.jpg" } = {}) {
  const formData = new FormData();
  formData.append("file", new File([content], name, { type }));
  return POST(
    new Request("https://rovaro.autos/api/order/driving-licence/intake", {
      method: "POST",
      body: formData,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLicenceUploadRateLimit();
  capturedUploadOptions = null;
  uploadOutcome = {
    result: {
      public_id: "carsnk/orders/licence-intake/2026-06/abc123",
      type: "authenticated",
    },
    error: null,
  };
});

describe("a successful public upload", () => {
  it("returns an opaque receipt and a checksum", async () => {
    const res = await upload();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(body.receipt).toBeTruthy();
    expect(body.uploadedAt).toBeTruthy();
  });

  it("never returns a storage URL or a storage reference to the browser", async () => {
    const body = await (await upload()).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("http");
    expect(serialised).not.toContain("cloudinary");
    expect(serialised).not.toContain("carsnk/orders");
    expect(body.url).toBeUndefined();
    expect(body.publicId).toBeUndefined();
    expect(body.secure_url).toBeUndefined();
  });

  it("stores the document so that no plain delivery URL works", async () => {
    await upload();
    expect(capturedUploadOptions).toEqual(
      expect.objectContaining({ type: "authenticated", resource_type: "image" })
    );
  });

  it("mints a receipt the server can verify back into the stored document", async () => {
    const body = await (await upload()).json();
    const verified = verifyUploadReceipt(body.receipt);
    expect(verified.ok).toBe(true);
    expect(verified.upload.storageReference).toBe(
      "carsnk/orders/licence-intake/2026-06/abc123"
    );
    expect(verified.upload.checksum).toBe(body.checksum);
  });

  it("audits the upload with the reference and checksum, not the bytes", async () => {
    const body = await (await upload()).json();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DRIVING_LICENCE_UPLOADED",
        result: "success",
      })
    );
    const logged = JSON.stringify(recordAuditEvent.mock.calls[0][0]);
    expect(logged).toContain(body.checksum);
    expect(logged).not.toContain(BYTES);
    expect(logged).not.toContain(body.receipt);
  });

  it("stores PDFs as raw resources", async () => {
    await upload({ type: "application/pdf", name: "licence.pdf" });
    expect(capturedUploadOptions.resource_type).toBe("raw");
  });
});

describe("rejected uploads produce no receipt", () => {
  it("refuses a file type that is not an identity document", async () => {
    const res = await upload({ type: "text/html", name: "evil.html" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("UNSUPPORTED_TYPE");
    expect(body.receipt).toBeUndefined();
  });

  it("refuses an empty file", async () => {
    const res = await upload({ content: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).receipt).toBeUndefined();
  });

  it("refuses a request with no file at all", async () => {
    const res = await POST(
      new Request("https://rovaro.autos/api/order/driving-licence/intake", {
        method: "POST",
        body: new FormData(),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_FILE");
  });

  it("gives no receipt when storage itself fails", async () => {
    uploadOutcome = { result: null, error: new Error("storage down") };
    const res = await upload();
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.receipt).toBeUndefined();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DRIVING_LICENCE_UPLOAD_FAILED",
        result: "failure",
      })
    );
  });

  it("gives no receipt when the signing secret is missing", async () => {
    const previous = process.env.DRIVING_LICENCE_RECEIPT_SECRET;
    delete process.env.DRIVING_LICENCE_RECEIPT_SECRET;
    delete process.env.BOOKING_CONFIRM_SECRET;
    delete process.env.EMAIL_ACTION_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_URL;
    try {
      const res = await upload();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("RECEIPT_UNAVAILABLE");
      expect(body.receipt).toBeUndefined();
    } finally {
      process.env.DRIVING_LICENCE_RECEIPT_SECRET = previous;
    }
  });
});

describe("rate limiting", () => {
  it("stops an intake flood from one address", async () => {
    let limited = null;
    for (let attempt = 0; attempt < 20 && !limited; attempt += 1) {
      const res = await upload();
      if (res.status === 429) limited = res;
    }
    expect(limited).not.toBeNull();
    expect((await limited.json()).code).toBe("RATE_LIMITED");
  });
});
