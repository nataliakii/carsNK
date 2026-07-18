import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import WebsiteVisit from "@models/WebsiteVisit";

function parsePositiveInt(value, fallback, { min = 1, max = 200 } = {}) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseDays(value, fallback = 7) {
  return parsePositiveInt(value, fallback, { min: 1, max: 90 });
}

/**
 * GET /api/admin/website-visits
 * Query: days=7, page=1, limit=50, country=, q= (url/path/ip/city)
 */
export async function GET(request) {
  try {
    await connectToDB();
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const days = parseDays(searchParams.get("days"), 7);
    const page = parsePositiveInt(searchParams.get("page"), 1, {
      min: 1,
      max: 1000,
    });
    const limit = parsePositiveInt(searchParams.get("limit"), 50, {
      min: 1,
      max: 100,
    });
    const country = String(searchParams.get("country") || "").trim();
    const q = String(searchParams.get("q") || "").trim();

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter = { createdAt: { $gte: since } };

    if (country) {
      filter.country = new RegExp(
        `^${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      );
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");
      filter.$or = [
        { url: rx },
        { path: rx },
        { ip: rx },
        { city: rx },
        { region: rx },
        { host: rx },
        { language: rx },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, visits, byDay, byCountry, byPath] = await Promise.all([
      WebsiteVisit.countDocuments(filter),
      WebsiteVisit.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebsiteVisit.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      WebsiteVisit.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$country", ""] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      WebsiteVisit.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$path", ""] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
    ]);

    return Response.json({
      success: true,
      data: {
        visits,
        total,
        page,
        limit,
        days,
        stats: {
          byDay: byDay.map((row) => ({ date: row._id, count: row.count })),
          byCountry: byCountry.map((row) => ({
            country: row._id || "unknown",
            count: row.count,
          })),
          byPath: byPath.map((row) => ({
            path: row._id || "/",
            count: row.count,
          })),
        },
      },
    });
  } catch (error) {
    console.error("[website-visits GET]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
