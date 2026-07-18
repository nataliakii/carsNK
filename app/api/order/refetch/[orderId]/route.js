import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { withOrderVisibility } from "@/middleware/withOrderVisibility";

async function handler(request, { params }) {
  try {
    await connectToDB();

    const { orderId } = params;
    if (!orderId) {
      return new Response("Order ID is required", { status: 400 });
    }

    const order = await Order.findById(orderId).lean();

    if (!order) {
      return new Response("Order not found", { status: 404 });
    }

    return new Response(JSON.stringify(order), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return new Response(`Failed to fetch order: ${error.message}`, {
      status: 500,
    });
  }
}

export const GET = withOrderVisibility(handler);
