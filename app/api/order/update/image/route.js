import { NextResponse } from "next/server";
import cloudinary, {
  ensureCloudinaryConfigured,
} from "@utils/cloudinary";
import { getCloudinaryCarsFolder } from "@config/cloudinary";

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
    const file = formData.get("image");

    // Check if file is provided
    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload image to Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: getCloudinaryCarsFolder(),
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      // Create a buffer stream and pipe the buffer to the upload stream
      const stream = require("stream");
      const passthrough = new stream.PassThrough();
      passthrough.end(buffer);
      passthrough.pipe(uploadStream);
    });

    console.log("RESULT", cloudinaryResult);

    // Cloudinary upload result
    return NextResponse.json({
      success: true,
      data: cloudinaryResult.public_id,
      message: "File uploaded successfully to Cloudinary",
    });
  } catch (e) {
    console.error("Error in image upload:", e);
    return NextResponse.json(
      { success: false, message: e.message },
      { status: 500 }
    );
  }
}
