import { NextResponse } from "next/server";
import cloudinary, {
  ensureCloudinaryConfigured,
} from "@utils/cloudinary";
import { buildOrderDrivingLicenceFolderPath } from "@/domain/orders/orderDrivingLicenceFolder";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        unique_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    const stream = require("stream");
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

export async function POST(req) {
  try {
    const cfg = ensureCloudinaryConfigured();
    if (!cfg.ok) {
      return NextResponse.json(
        { success: false, message: cfg.message },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const customerName = String(formData.get("customerName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const rentalStartDate = formData.get("rentalStartDate");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const mime = String(file.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(mime)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPEG, PNG, WebP or HEIC images are allowed",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "File too large (max 10 MB)" },
        { status: 400 }
      );
    }

    const folder = buildOrderDrivingLicenceFolderPath(
      customerName,
      email,
      rentalStartDate
    );
    const result = await uploadBufferToCloudinary(buffer, folder);

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (e) {
    console.error("[upload-driving-licence]", e);
    return NextResponse.json(
      { success: false, message: e.message || "Upload failed" },
      { status: 500 }
    );
  }
}
