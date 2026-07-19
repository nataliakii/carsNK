import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { User } from "@models/user";
import { Car } from "@models/car";

export const runtime = "nodejs";

const PARTNER_COMPANY_DEFAULTS = {
  tel: "+30 000 000 0000",
  email: "partner@example.com",
  address: "Greece",
  coords: { lat: "40.31", lon: "23.06" },
  hoursDiffForStart: 1,
  hoursDiffForEnd: -1,
  bufferTime: 2,
  defaultStart: "14:00",
  defaultEnd: "12:00",
  seasons: {
    NoSeason: { start: "01/10", end: "24/05" },
    LowSeason: { start: "25/05", end: "30/06" },
    LowUpSeason: { start: "01/09", end: "30/09" },
    MiddleSeason: { start: "01/07", end: "31/07" },
    HighSeason: { start: "01/08", end: "31/08" },
  },
  useSeasons: true,
  langAdmin: "en",
  langSuperadmin: "en",
  useEmail: true,
  minRentalDuration: 1,
  workingHours: { start: "08:00", end: "22:00" },
  deliveryPricePerKm: 1,
};

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** GET: companies + admin users + car counts (superadmin). */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const [companies, users, carCounts] = await Promise.all([
    Company.find({}).sort({ name: 1 }).lean(),
    User.find({ isAdmin: true })
      .select("username email role ownerId isAdmin createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Car.aggregate([{ $group: { _id: "$ownerId", count: { $sum: 1 } } }]),
  ]);

  const countByOwner = {};
  for (const row of carCounts) {
    countByOwner[row._id ? String(row._id) : "null"] = row.count;
  }

  return json({
    success: true,
    companies: (companies || []).map((c) => ({
      ...c,
      carCount: countByOwner[String(c._id)] || 0,
    })),
    users: users || [],
    unassignedCarCount: countByOwner.null || 0,
  });
}

/** POST: create partner company { name, email?, tel?, address? }. */
export async function POST(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const name = String(body?.name || "").trim();
  if (!name) {
    return json({ success: false, message: "name is required" }, 400);
  }

  await connectToDB();
  const company = await Company.create({
    ...PARTNER_COMPANY_DEFAULTS,
    name,
    email: String(body?.email || "").trim() || PARTNER_COMPANY_DEFAULTS.email,
    tel: String(body?.tel || "").trim() || PARTNER_COMPANY_DEFAULTS.tel,
    address:
      String(body?.address || "").trim() || PARTNER_COMPANY_DEFAULTS.address,
  });

  return json({ success: true, company }, 201);
}
