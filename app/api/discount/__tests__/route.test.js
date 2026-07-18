jest.mock("@lib/database", () => ({
  connectToDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@models/DiscountSetting", () => ({
  __esModule: true,
  default: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

const { connectToDB } = require("@lib/database");
const DiscountSetting = require("@models/DiscountSetting").default;
const { POST, GET } = require("../route");

describe("discount route versioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST creates new active discount and deactivates previous", async () => {
    const created = {
      _id: "new-discount",
      discount: 15,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-10"),
      active: true,
      appliedOrderIds: [],
    };
    DiscountSetting.updateMany.mockResolvedValue({ acknowledged: true });
    DiscountSetting.create.mockResolvedValue(created);

    const req = new Request("http://localhost/api/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discount: 15,
        startDate: "2026-07-01",
        endDate: "2026-07-10",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(connectToDB).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(DiscountSetting.updateMany).toHaveBeenCalledWith(
      { active: true },
      { $set: { active: false } }
    );
    expect(DiscountSetting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discount: 15,
        active: true,
        appliedOrderIds: [],
      })
    );
    expect(body.success).toBe(true);
    expect(body.data._id).toBe("new-discount");
  });

  test("POST rejects invalid date range", async () => {
    const req = new Request("http://localhost/api/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discount: 10,
        startDate: "2026-08-10",
        endDate: "2026-08-01",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/endDate/i);
    expect(DiscountSetting.updateMany).not.toHaveBeenCalled();
    expect(DiscountSetting.create).not.toHaveBeenCalled();
  });

  test("GET returns active only by default and history when requested", async () => {
    const activeDoc = { _id: "active-1", discount: 20, active: true };
    const historyDocs = [
      { _id: "active-1", active: true },
      { _id: "old-1", active: false },
    ];

    DiscountSetting.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(activeDoc),
      }),
    });
    DiscountSetting.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(historyDocs),
      }),
    });

    const resDefault = await GET(new Request("http://localhost/api/discount"));
    const bodyDefault = await resDefault.json();
    expect(resDefault.status).toBe(200);
    expect(bodyDefault._id).toBe("active-1");

    const resHistory = await GET(
      new Request("http://localhost/api/discount?history=1")
    );
    const bodyHistory = await resHistory.json();
    expect(resHistory.status).toBe(200);
    expect(bodyHistory.active._id).toBe("active-1");
    expect(bodyHistory.history).toHaveLength(2);
  });
});
