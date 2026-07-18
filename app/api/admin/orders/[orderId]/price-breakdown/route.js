import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { PriceBreakdown } from "@models/PriceBreakdown";

export const GET = async (request, { params }) => {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { orderId } = params;
    const breakdown = await PriceBreakdown.findOne({ order: orderId }).lean();

    if (!breakdown) {
      return new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: breakdown }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching price breakdown:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
