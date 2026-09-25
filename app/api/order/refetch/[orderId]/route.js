import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { requireAdmin } from "@lib/adminAuth";
import { withOrderVisibility } from "@/middleware/withOrderVisibility";
import { supplierCanReadOrder } from "@/domain/admin/supplierOrderAccess";

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function handler(request, context) {
  try {
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    await connectToDB();
    const params = context?.params ? await context.params : {};
    const orderId = String(params.orderId || "").trim();
    if (!orderId) {
      return json({ success: false, message: "Not found" }, 404);
    }

    const order = await Order.findById(orderId)
      .populate({
        path: "car",
        select:
          "model class transmission fueltype seats numberOfDoors airConditioning registration carNumber regNumber deposit franchise photoUrl photos ownerId",
      })
      .lean();
    const access = supplierCanReadOrder(session.user, order);
    if (!access.ok) {
      return json({ success: false, message: "Not found" }, access.status === 401 ? 401 : 404);
    }

    return new Response(JSON.stringify(order), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return json({ success: false, message: "Not found" }, 404);
  }
}

export const GET = withOrderVisibility(handler);
