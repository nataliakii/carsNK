import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import {
  persistOfficeShape,
  publicOfficeView,
} from "@/domain/company/officeRecord";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function resolveCompanyId(user, requested) {
  if (isSuperAdminUser(user) && requested) return String(requested);
  return getSessionOwnerId(user);
}

export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const user = session.user;
  const url = new URL(request.url);
  const companyId = resolveCompanyId(user, url.searchParams.get("companyId"));
  if (!companyId) return json({ success: false, message: "Company required" }, 400);

  await connectToDB();
  const company = await Company.findById(companyId).lean();
  if (!company) return json({ success: false, message: "Company not found" }, 404);

  const includeArchived =
    url.searchParams.get("includeArchived") === "1" && isSuperAdminUser(user);
  const offices = (company.offices || [])
    .filter((row) => includeArchived || row.status !== "archived")
    .map((row) => ({
      ...row,
      id: String(row._id),
      companyId: String(company._id),
    }));

  return json({ success: true, offices });
}

export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const user = session.user;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const companyId = resolveCompanyId(user, body.companyId);
  if (!companyId) return json({ success: false, message: "Company required" }, 400);

  const office = persistOfficeShape(body, { assignId: true });
  if (!office) return json({ success: false, message: "Office name is required" }, 400);

  await connectToDB();
  const company = await Company.findByIdAndUpdate(
    companyId,
    { $push: { offices: office } },
    { new: true }
  ).lean();
  if (!company) return json({ success: false, message: "Company not found" }, 404);

  const created = company.offices[company.offices.length - 1];
  await recordAuditEvent({
    action: "COMPANY_OFFICE_CREATED",
    userRole: isSuperAdminUser(user) ? "superadmin" : "admin",
    userId: user.id,
    userEmail: user.email,
    metadata: { companyId, officeId: String(created?._id) },
  });

  return json({
    success: true,
    office: {
      ...created,
      id: String(created?._id),
      companyId,
      public: publicOfficeView(created, { companyPhone: company.tel }),
    },
  });
}
