import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { Order } from "@models/order";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import {
  archiveOfficeRecord,
  officeIdString,
  persistOfficeShape,
} from "@/domain/company/officeRecord";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function loadOwnedOffice(user, officeId) {
  const ownerId = getSessionOwnerId(user);
  const query = isSuperAdminUser(user)
    ? { "offices._id": officeId }
    : { _id: ownerId, "offices._id": officeId };
  const company = await Company.findOne(query);
  if (!company) return { company: null, office: null };
  const office = company.offices.id(officeId);
  return { company, office };
}

export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const resolved = await Promise.resolve(params);
  const officeId = officeIdString(resolved?.id);
  if (!officeId) return json({ success: false, message: "Office id required" }, 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  await connectToDB();
  const { company, office } = await loadOwnedOffice(session.user, officeId);
  if (!company || !office) {
    return json({ success: false, message: "Office not found" }, 404);
  }

  const next = persistOfficeShape({ ...office.toObject(), ...body, _id: office._id });
  if (!next) {
    return json({ success: false, message: "Office name is required" }, 400);
  }
  // Do not overwrite the subdocument ObjectId with a string copy.
  const { _id: _ignored, ...fields } = next;
  Object.assign(office, fields);
  await company.save();

  await recordAuditEvent({
    action: "COMPANY_OFFICE_UPDATED",
    userRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
    userId: session.user.id,
    userEmail: session.user.email,
    metadata: { companyId: String(company._id), officeId },
  });

  return json({ success: true, office: office.toObject() });
}

export async function DELETE(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const resolved = await Promise.resolve(params);
  const officeId = officeIdString(resolved?.id);
  if (!officeId) return json({ success: false, message: "Office id required" }, 400);

  await connectToDB();
  const { company, office } = await loadOwnedOffice(session.user, officeId);
  if (!company || !office) {
    return json({ success: false, message: "Office not found" }, 404);
  }

  const referenced = await Order.exists({
    $or: [
      { "locationSnapshot.pickup.officeId": officeId },
      { "locationSnapshot.return.officeId": officeId },
    ],
  });

  const archived = archiveOfficeRecord(office.toObject());
  Object.assign(office, archived);
  if (!referenced) {
    office.status = "archived";
  }
  await company.save();

  await recordAuditEvent({
    action: "COMPANY_OFFICE_ARCHIVED",
    userRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
    userId: session.user.id,
    userEmail: session.user.email,
    metadata: { companyId: String(company._id), officeId, referenced: Boolean(referenced) },
  });

  return json({ success: true, archived: true, referenced: Boolean(referenced) });
}
