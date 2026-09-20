/**
 * @jest-environment node
 */
jest.mock("@lib/adminAuth", () => ({ requireSuperAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  retentionJobRateLimitOptions: jest.fn(() => ({ tableName: "t" })),
}));
jest.mock("@/domain/legal/drivingLicenceRetention", () => ({
  runDrivingLicenceRetention: jest.fn(),
}));

import { requireSuperAdmin } from "@lib/adminAuth";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { runDrivingLicenceRetention } from "@/domain/legal/drivingLicenceRetention";
import { GET, POST } from "../route";

const ENDPOINT = "https://rovaro.autos/api/admin/legal/driving-licence-retention";
const SECRET = "a-long-random-scheduler-secret";

function request(url = ENDPOINT, headers = {}) {
  return new Request(url, { method: "POST", headers });
}

function unauthenticated() {
  requireSuperAdmin.mockResolvedValue({
    session: null,
    errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });
}

function asSuperadmin() {
  requireSuperAdmin.mockResolvedValue({
    session: { user: { email: "root@rovaro.autos" } },
    errorResponse: null,
  });
}

const ORIGINAL_ENV = {
  CRON_SECRET: process.env.CRON_SECRET,
  DOCUMENT_RETENTION_CRON_SECRET: process.env.DOCUMENT_RETENTION_CRON_SECRET,
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DOCUMENT_RETENTION_CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
  consumePublicPostOrError.mockResolvedValue(null);
  runDrivingLicenceRetention.mockResolvedValue({ scanned: 0, deleted: 0 });
  unauthenticated();
});

afterAll(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("authentication", () => {
  it("refuses an anonymous caller", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(runDrivingLicenceRetention).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const res = await POST(
      request(ENDPOINT, { authorization: "Bearer not-the-secret" })
    );
    expect(res.status).toBe(401);
    expect(runDrivingLicenceRetention).not.toHaveBeenCalled();
  });

  it("refuses a bearer token when no secret is configured at all", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(request(ENDPOINT, { authorization: "Bearer " }));
    expect(res.status).toBe(401);
    expect(runDrivingLicenceRetention).not.toHaveBeenCalled();
  });

  it("accepts the Vercel Cron bearer token", async () => {
    const res = await GET(request(ENDPOINT, { authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(runDrivingLicenceRetention).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: false, trigger: "cron" })
    );
  });

  it("accepts the job-specific header secret", async () => {
    process.env.DOCUMENT_RETENTION_CRON_SECRET = "own-key-for-this-job";
    const res = await POST(
      request(ENDPOINT, { "x-retention-cron-secret": "own-key-for-this-job" })
    );
    expect(res.status).toBe(200);
  });

  it("lets a superadmin trigger a real run over POST", async () => {
    asSuperadmin();
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(runDrivingLicenceRetention).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        trigger: "superadmin:root@rovaro.autos",
      })
    );
  });

  it("forces a superadmin GET into dry-run", async () => {
    asSuperadmin();
    await GET(new Request(ENDPOINT));
    expect(runDrivingLicenceRetention).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
  });
});

describe("dry run", () => {
  it("is honoured for the scheduler", async () => {
    await GET(
      request(`${ENDPOINT}?dryRun=1`, { authorization: `Bearer ${SECRET}` })
    );
    expect(runDrivingLicenceRetention).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
  });
});

describe("rate limiting", () => {
  it("rejects before touching authentication or the job", async () => {
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, code: "RATE_LIMIT" },
    });

    const res = await POST(request(ENDPOINT, { authorization: `Bearer ${SECRET}` }));

    expect(res.status).toBe(429);
    expect(requireSuperAdmin).not.toHaveBeenCalled();
    expect(runDrivingLicenceRetention).not.toHaveBeenCalled();
  });
});

describe("response", () => {
  it("returns the run summary", async () => {
    runDrivingLicenceRetention.mockResolvedValue({
      scanned: 7,
      deleted: 5,
      failed: 1,
      skipped: 1,
    });

    const res = await GET(request(ENDPOINT, { authorization: `Bearer ${SECRET}` }));
    const body = await res.json();

    expect(body).toEqual({
      success: true,
      summary: { scanned: 7, deleted: 5, failed: 1, skipped: 1 },
    });
  });
});
