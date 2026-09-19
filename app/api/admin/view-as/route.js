import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import {
  ADMIN_VIEW_AS_COOKIE,
  adminViewAsCookieOptions,
  parseViewAsCompanyId,
} from "@/domain/owners/adminViewAs";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** GET: current view-as company (if any). */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const raw = request.cookies.get(ADMIN_VIEW_AS_COOKIE)?.value;
  const companyId = parseViewAsCompanyId(raw);
  if (!companyId) {
    return json({ success: true, active: false, company: null });
  }

  await connectToDB();
  const company = await Company.findById(companyId)
    .select("name email country slug")
    .lean();
  if (!company) {
    const res = json({ success: true, active: false, company: null });
    res.cookies.set(ADMIN_VIEW_AS_COOKIE, "", {
      ...adminViewAsCookieOptions(),
      maxAge: 0,
    });
    return res;
  }

  return json({
    success: true,
    active: true,
    company: {
      _id: String(company._id),
      name: company.name,
      email: company.email,
      country: company.country,
      slug: company.slug,
    },
  });
}

/** POST: enter company admin scope { companyId }. */
export async function POST(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const companyId = parseViewAsCompanyId(body?.companyId);
  if (!companyId) {
    return json({ success: false, message: "companyId required" }, 400);
  }

  await connectToDB();
  const company = await Company.findById(companyId)
    .select("name email country slug")
    .lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  const res = json({
    success: true,
    active: true,
    company: {
      _id: String(company._id),
      name: company.name,
      email: company.email,
      country: company.country,
      slug: company.slug,
    },
  });
  res.cookies.set(ADMIN_VIEW_AS_COOKIE, companyId, adminViewAsCookieOptions());
  return res;
}

/** DELETE: exit view-as mode. */
export async function DELETE(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const res = json({ success: true, active: false, company: null });
  res.cookies.set(ADMIN_VIEW_AS_COOKIE, "", {
    ...adminViewAsCookieOptions(),
    maxAge: 0,
  });
  return res;
}
