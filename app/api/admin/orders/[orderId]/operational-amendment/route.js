import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { Car } from "@models/car";
import { ROLE } from "@models/user";
import {
  isPlatformBooking,
  resolvePlatformWorkflowStage,
  PLATFORM_WORKFLOW_STAGE,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import {
  bookingIsPaid,
  validateCompanyOperationalAmendment,
} from "@/domain/orders/bookingAmendment";
import { parseCustomerPhone } from "@/domain/validation/customerPhone";
import { parseOptionalCustomerEmail } from "@/domain/validation/customerEmail";
import { normalizeDrivingLicenceUrls } from "@/domain/orders/normalizeDrivingLicenceUrls";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_INSURANCE = new Set(["", "CDW", "FULL", "BASIC", "SUPER_CDW"]);
const ALLOWED_VERIFICATION = new Set(["PENDING", "VERIFIED", "REJECTED"]);

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function actorRole(user) {
  return Number(user?.role) === ROLE.SUPERADMIN ||
    String(user?.roleName || user?.role || "")
      .toLowerCase()
      .includes("super")
    ? "SUPERADMIN"
    : "ADMIN";
}

function comparable(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.toString) return value.toString();
  return String(value);
}

async function loadEditableOrder(request, orderId) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return { errorResponse };
  await connectToDB();
  const order = await Order.findById(orderId);
  if (!order)
    return {
      response: json({ success: false, message: "Booking not found" }, 404),
    };
  if (!isPlatformBooking(order)) {
    return {
      response: json(
        { success: false, message: "Only platform bookings can be amended" },
        409
      ),
    };
  }
  const superadmin = actorRole(session.user) === "SUPERADMIN";
  const ownerId = String(session.user?.ownerId || "");
  if (!superadmin && (!ownerId || ownerId !== String(order.ownerId || ""))) {
    return {
      response: json(
        { success: false, message: "This booking belongs to another company" },
        403
      ),
    };
  }
  const stage = resolvePlatformWorkflowStage(order);
  if (
    !bookingIsPaid(order) ||
    ![
      PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
      PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING,
      PLATFORM_WORKFLOW_STAGE.COMPLETED,
    ].includes(stage)
  ) {
    return {
      response: json(
        {
          success: false,
          message: "Only paid or completed bookings can be amended",
        },
        409
      ),
    };
  }
  const capabilities = resolveOrderCapabilities(order, session.user);
  if (!capabilities[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]) {
    return {
      response: json(
        { success: false, message: "You cannot amend this booking" },
        403
      ),
    };
  }
  return { session, order, superadmin };
}

export async function GET(request, { params }) {
  const { orderId } = await params;
  const loaded = await loadEditableOrder(request, orderId);
  if (loaded.errorResponse) return loaded.errorResponse;
  if (loaded.response) return loaded.response;
  const vehicles = await Car.find({
    ownerId: loaded.order.ownerId,
    deletedAt: null,
    archived: { $ne: true },
  })
    .select("_id make model carNumber")
    .lean();
  return json({
    success: true,
    vehicles: vehicles.map((car) => ({
      carId: String(car._id),
      label: [car.make, car.model, car.carNumber].filter(Boolean).join(" · "),
    })),
  });
}

export async function POST(request, { params }) {
  const { orderId } = await params;
  const loaded = await loadEditableOrder(request, orderId);
  if (loaded.errorResponse) return loaded.errorResponse;
  if (loaded.response) return loaded.response;
  const { session, order, superadmin } = loaded;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const changes = payload?.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return json(
      { success: false, message: "Amendment changes are required" },
      400
    );
  }

  const validationOrder = {
    ...order.toObject(),
    drivingLicenceVerificationStatus:
      order.drivingLicenceVerificationStatus || "PENDING",
    car: comparable(order.car?._id || order.car),
  };
  const normalizedChanges = { ...changes };
  let replacementCar = null;
  if (normalizedChanges.actualCarId !== undefined) {
    const actualCarId = String(normalizedChanges.actualCarId || "").trim();
    delete normalizedChanges.actualCarId;
    if (actualCarId) {
      replacementCar = await Car.findById(actualCarId);
      if (
        !replacementCar ||
        String(replacementCar.ownerId || "") !== String(order.ownerId || "") ||
        replacementCar.deletedAt ||
        replacementCar.archived === true
      ) {
        return json(
          {
            success: false,
            message: "The supplied vehicle must belong to this fleet",
          },
          400
        );
      }
      normalizedChanges.actualVehicle = {
        carId: String(replacementCar._id),
        make: replacementCar.make || "",
        model: replacementCar.model || "",
        carNumber: replacementCar.carNumber || "",
      };
    } else {
      normalizedChanges.actualVehicle = null;
    }
  }
  if (normalizedChanges.ChildSeats !== undefined) {
    const seats = Number(normalizedChanges.ChildSeats);
    if (!Number.isInteger(seats) || seats < 0 || seats > 5) {
      return json(
        { success: false, message: "Child seats must be between 0 and 5" },
        400
      );
    }
    normalizedChanges.ChildSeats = seats;
  }
  if (
    normalizedChanges.secondDriver !== undefined &&
    typeof normalizedChanges.secondDriver !== "boolean"
  ) {
    return json(
      { success: false, message: "Second driver value is invalid" },
      400
    );
  }
  if (
    normalizedChanges.insurance !== undefined &&
    !ALLOWED_INSURANCE.has(
      String(normalizedChanges.insurance).trim().toUpperCase()
    )
  ) {
    return json(
      { success: false, message: "Insurance option is invalid" },
      400
    );
  }
  if (
    normalizedChanges.drivingLicenceVerificationStatus !== undefined &&
    !ALLOWED_VERIFICATION.has(
      String(normalizedChanges.drivingLicenceVerificationStatus).toUpperCase()
    )
  ) {
    return json(
      { success: false, message: "Document verification status is invalid" },
      400
    );
  }
  for (const field of [
    "customerName",
    "placeInDetail",
    "placeOutDetail",
    "flightNumber",
    "hotelInformation",
    "pickupNotes",
    "returnNotes",
    "operationalNotes",
  ]) {
    if (normalizedChanges[field] !== undefined) {
      normalizedChanges[field] = String(normalizedChanges[field] ?? "").trim();
      if (
        normalizedChanges[field].length >
        (field === "customerName"
          ? 160
          : [
              "placeInDetail",
              "placeOutDetail",
              "flightNumber",
              "hotelInformation",
            ].includes(field)
          ? 500
          : 2000)
      ) {
        return json({ success: false, message: `${field} is too long` }, 400);
      }
    }
  }
  if (normalizedChanges.phone !== undefined) {
    const phone = parseCustomerPhone(normalizedChanges.phone, {
      required: false,
    });
    if (!phone.ok)
      return json(
        { success: false, message: "Customer phone is invalid" },
        400
      );
    normalizedChanges.phone = phone.phone;
  }
  if (normalizedChanges.email !== undefined) {
    const email = parseOptionalCustomerEmail(normalizedChanges.email);
    if (!email.ok)
      return json(
        { success: false, message: "Customer email is invalid" },
        400
      );
    normalizedChanges.email = email.email;
  }
  for (const field of ["Viber", "Whatsapp", "Telegram"]) {
    if (
      normalizedChanges[field] !== undefined &&
      typeof normalizedChanges[field] !== "boolean"
    ) {
      return json(
        { success: false, message: `${field} value is invalid` },
        400
      );
    }
  }
  if (normalizedChanges.drivingLicenceUrls !== undefined) {
    normalizedChanges.drivingLicenceUrls = normalizeDrivingLicenceUrls(
      normalizedChanges.drivingLicenceUrls
    );
  }

  const validation = validateCompanyOperationalAmendment({
    order: validationOrder,
    changes: normalizedChanges,
    customerConsentRecorded: payload.customerConsentRecorded,
    customerConsentNote: payload.customerConsentNote,
    actor: {
      id: session.user?.id || session.user?._id,
      email: session.user?.email,
      role: superadmin ? "SUPERADMIN" : "ADMIN",
    },
  });
  if (!validation.ok) {
    return json(
      {
        success: false,
        code: validation.code,
        message: validation.message,
        fields: validation.fields,
      },
      validation.status
    );
  }

  for (const field of validation.record.fieldsChanged) {
    const nextValue = normalizedChanges[field];
    if (field === "drivingLicenceVerificationStatus") {
      order.drivingLicenceVerificationStatus = nextValue;
    } else {
      order[field] = nextValue;
    }
  }

  const revisions = Array.isArray(order.operationalAmendments)
    ? order.operationalAmendments
    : [];
  const revision = validation.record;
  revision.note = String(payload.note || "")
    .trim()
    .slice(0, 1000);
  delete revision.checksum;
  revision.checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(revision))
    .digest("hex");
  order.operationalAmendments = [...revisions, revision];
  const saved = await order.save();
  await recordAuditEvent({
    action: "BOOKING_OPERATIONAL_AMENDED",
    userRole: superadmin ? "superadmin" : "admin",
    userId: session.user?.id || session.user?._id,
    userEmail: session.user?.email || "",
    severity: "medium",
    result: "success",
    reason: "Company operational amendment with customer agreement",
    orderData: { orderId: saved._id, orderNumber: saved.orderNumber },
    metadata: {
      revisionChecksum: revision.checksum,
      fieldsChanged: revision.fieldsChanged,
    },
  });

  return json({ success: true, updatedOrder: saved, revision });
}
