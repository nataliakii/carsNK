import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { User, ROLE } from "@models/user";
import { Car } from "@models/car";
import { COMPANY_ID } from "@config/company";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function parseCompanyId(params) {
  const id = params?.companyId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return String(id);
}

/** PATCH — update partner company name / email / tel */
export async function PATCH(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = parseCompanyId(params);
  if (!companyId) return json({ success: false, message: "Invalid company id" }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const updates = {};
  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) return json({ success: false, message: "name cannot be empty" }, 400);
    updates.name = name;
  }
  if (body?.email != null) {
    updates.email = String(body.email).trim();
  }
  if (body?.tel != null) {
    updates.tel = String(body.tel).trim();
  }

  if (!Object.keys(updates).length) {
    return json({ success: false, message: "Nothing to update" }, 400);
  }

  await connectToDB();
  const company = await Company.findByIdAndUpdate(
    companyId,
    { $set: updates },
    { new: true }
  ).lean();

  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  return json({ success: true, company });
}

/** DELETE — remove partner company (no cars; removes its admins) */
export async function DELETE(request, { params }) {
  const { errorResponse, session } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = parseCompanyId(params);
  if (!companyId) return json({ success: false, message: "Invalid company id" }, 400);

  if (companyId === String(COMPANY_ID)) {
    return json(
      { success: false, message: "Cannot delete the main site company" },
      400
    );
  }

  await connectToDB();
  const carCount = await Car.countDocuments({ ownerId: companyId });
  if (carCount > 0) {
    return json(
      {
        success: false,
        message: `Company still has ${carCount} car(s). Reassign or remove them first.`,
      },
      409
    );
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  const adminsDeleted = await User.deleteMany({
    ownerId: companyId,
    role: ROLE.ADMIN,
  });
  await Company.findByIdAndDelete(companyId);

  return json({
    success: true,
    deletedCompanyId: companyId,
    adminsRemoved: adminsDeleted.deletedCount || 0,
    deletedBy: session?.user?.email || null,
  });
}
