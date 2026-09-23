/**
 * @jest-environment node
 */
import { Writable } from "stream";

jest.mock("@lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@lib/database", () => ({
  connectToDB: jest.fn(),
}));

jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: {
    uploader: { upload_stream: jest.fn(), destroy: jest.fn() },
    url: jest.fn(() => "https://signed.example/doc"),
  },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));

jest.mock("@models/PartnerLegalProfile", () => {
  const Mock = jest.fn().mockImplementation((doc) => ({
    companyId: doc.companyId,
    verificationStatus: "DRAFT",
    documents: [],
    save: jest.fn().mockResolvedValue(undefined),
  }));
  Mock.findOne = jest.fn();
  Mock.findOneAndUpdate = jest.fn();
  return { __esModule: true, default: Mock };
});

jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
  extractAuditContext: jest.fn(() => ({ ipAddress: "", userAgent: "" })),
}));

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { POST } from "../route";

const COMPANY = "64b7f0c2a1b2c3d4e5f60789";
const ENDPOINT = "https://carsnk.gr/api/partner/legal/documents";

function asPartnerAdmin() {
  requireAdmin.mockResolvedValue({
    session: {
      user: {
        id: "user-1",
        email: "partner@example.com",
        role: 1,
        ownerId: COMPANY,
      },
    },
    errorResponse: null,
  });
}

function findOneResolves(profile) {
  PartnerLegalProfile.findOne.mockImplementation(() => {
    const promise = Promise.resolve(profile);
    return {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn(() => promise),
      then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
      catch: (onRejected) => promise.catch(onRejected),
    };
  });
}

function mockUploadStream({ error, result } = {}) {
  cloudinary.uploader.upload_stream.mockImplementation((_opts, cb) => {
    return new Writable({
      write(_chunk, _enc, next) {
        next();
      },
      final(done) {
        cb(error || null, error ? undefined : result);
        done();
      },
    });
  });
}

function uploadRequest({
  kind = "company_registration",
  type = "application/pdf",
  contents = "pdf-bytes",
  filename = "registry.pdf",
} = {}) {
  const body = new FormData();
  body.append("kind", kind);
  body.append("label", filename);
  body.append("file", new File([contents], filename, { type }));
  return new Request(ENDPOINT, { method: "POST", body });
}

describe("POST /api/partner/legal/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectToDB.mockResolvedValue({});
    ensureCloudinaryConfigured.mockReturnValue({ ok: true });
    asPartnerAdmin();
    findOneResolves({
      companyId: COMPANY,
      verificationStatus: "DRAFT",
      documents: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    PartnerLegalProfile.findOneAndUpdate.mockResolvedValue({
      companyId: COMPANY,
      verificationStatus: "DRAFT",
      documents: [{ kind: "company_registration" }],
    });
    mockUploadStream({
      result: { public_id: "carsnk/partners/x/legal/registry" },
    });
  });

  test("unauthenticated caller gets JSON from requireAdmin", async () => {
    requireAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const res = await POST(uploadRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ message: "Unauthorized" });
    expect(connectToDB).not.toHaveBeenCalled();
  });

  test("missing file returns JSON { error, message }", async () => {
    const body = new FormData();
    body.append("kind", "company_registration");
    const res = await POST(new Request(ENDPOINT, { method: "POST", body }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: "no_file",
      message: "No file uploaded",
    });
  });

  test("Cloudinary failure returns JSON 500 { error, message }", async () => {
    mockUploadStream({ error: new Error("Cloudinary timeout") });

    const res = await POST(uploadRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "upload_failed",
      message: "Upload failed",
    });
  });

  test("unhandled DB throw still returns JSON 500 { error, message }", async () => {
    connectToDB.mockRejectedValue(new Error("Mongo network"));

    const res = await POST(uploadRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "upload_failed",
      message: "Upload failed",
    });
  });

  test("successful upload returns JSON document", async () => {
    const res = await POST(uploadRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.document).toMatchObject({
      kind: "company_registration",
      label: "registry.pdf",
      accepted: false,
    });
    expect(PartnerLegalProfile.findOneAndUpdate).toHaveBeenCalled();
  });

  test("duplicate companyId insert is recovered instead of empty 500", async () => {
    const dup = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    const created = {
      companyId: COMPANY,
      verificationStatus: "DRAFT",
      documents: [],
      save: jest.fn().mockRejectedValue(dup),
    };
    PartnerLegalProfile.mockImplementation(() => created);

    const existing = {
      companyId: COMPANY,
      verificationStatus: "DRAFT",
      documents: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    PartnerLegalProfile.findOne
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementationOnce(() => Promise.resolve(existing));

    const res = await POST(uploadRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.document.kind).toBe("company_registration");
  });
});
