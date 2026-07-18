import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";

/**
 * POST { placeIn?: string, placeOut?: string } → delivery breakdown (zones + €/km from company).
 */
export async function POST(request) {
  try {
    await connectToDB();
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const placeIn = typeof body.placeIn === "string" ? body.placeIn.trim() : "";
    const placeOut = typeof body.placeOut === "string" ? body.placeOut.trim() : "";

    const data = await calculateDeliveryPrice({ placeIn, placeOut });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("[delivery-quote POST]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
