import { NextResponse } from "next/server";

import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import {
  consumeLicenceUploadAttempt,
  licenceIntakeFolder,
  licenceUploadRateKey,
  MAX_LICENCE_UPLOAD_BYTES,
  storageResourceType,
  validateLicenceUpload,
} from "@/domain/legal/drivingLicenceIntake";
import {
  checksumForBytes,
  createUploadReceipt,
} from "@/domain/legal/drivingLicenceUploadReceipt";
import { extractAuditContext, recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/order/driving-licence/intake
 *
 * Public driving-licence upload for a booking request that does not exist yet.
 *
 * The response never contains a storage URL. The browser gets an opaque signed
 * receipt which POST /api/order/add re-verifies; a partial or failed upload
 * yields no receipt, so the booking cannot be created. Reading the document
 * later is a separate, authorised decision made by the download endpoint.
 */
export async function POST(request) {
  const { ipAddress, userAgent } = extractAuditContext(request);
  const limit = consumeLicenceUploadAttempt(licenceUploadRateKey(ipAddress));
  if (limit.limited) {
    return NextResponse.json(
      { success: false, code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    console.error("[licence-intake] storage not configured");
    return NextResponse.json(
      { success: false, code: "STORAGE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  let file;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json(
      { success: false, code: "NO_FILE" },
      { status: 400 }
    );
  }

  const declaredSize = Number(file.size) || 0;
  if (declaredSize > MAX_LICENCE_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, code: "TOO_LARGE" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = validateLicenceUpload({
    contentType: file.type,
    byteSize: buffer.length,
  });
  if (!check.ok) {
    return NextResponse.json(
      { success: false, code: check.code },
      { status: 400 }
    );
  }

  const checksum = checksumForBytes(buffer);
  const resourceType = storageResourceType(check.contentType);

  let stored;
  try {
    stored = await uploadToAuthenticatedStorage(buffer, {
      folder: licenceIntakeFolder(),
      resourceType,
    });
  } catch (err) {
    // No receipt is minted, so no booking can be created from this attempt.
    console.error("[licence-intake] upload failed", err?.message || err);
    await recordAuditEvent({
      action: "DRIVING_LICENCE_UPLOAD_FAILED",
      userRole: "system",
      severity: "medium",
      result: "failure",
      ipAddress,
      userAgent,
      metadata: { resourceType, byteSize: buffer.length },
      errorMessage: String(err?.message || "upload failed").slice(0, 500),
    });
    return NextResponse.json(
      { success: false, code: "UPLOAD_FAILED" },
      { status: 502 }
    );
  }

  const uploadedAt = new Date();
  const receipt = createUploadReceipt({
    storageReference: stored.publicId,
    storageType: stored.storageType,
    checksum,
    uploadedAt,
    byteSize: buffer.length,
    contentType: check.contentType,
  });

  if (!receipt.ok) {
    console.error("[licence-intake] receipt unavailable", receipt.code);
    return NextResponse.json(
      { success: false, code: "UPLOAD_FAILED" },
      { status: 503 }
    );
  }

  await recordAuditEvent({
    action: "DRIVING_LICENCE_UPLOADED",
    userRole: "system",
    severity: "medium",
    result: "success",
    ipAddress,
    userAgent,
    // Reference and checksum only: never the bytes, never a delivery URL.
    metadata: {
      assetRef: stored.publicId,
      checksum,
      byteSize: buffer.length,
      contentType: check.contentType,
    },
  });

  return NextResponse.json({
    success: true,
    receipt: receipt.receipt,
    checksum,
    uploadedAt: uploadedAt.toISOString(),
    fileName: String(file.name || "").slice(0, 120),
  });
}

/**
 * Store with Cloudinary delivery type `authenticated`: the plain delivery URL
 * is unusable without a signature, so there is no permanent raw URL to leak
 * even if the reference escapes.
 */
function uploadToAuthenticatedStorage(buffer, { folder, resourceType }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        type: "authenticated",
        unique_filename: true,
        use_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result?.public_id) {
          reject(error || new Error("Storage did not return a reference"));
          return;
        }
        resolve({
          publicId: result.public_id,
          storageType: String(result.type || "authenticated"),
        });
      }
    );
    uploadStream.end(buffer);
  });
}
