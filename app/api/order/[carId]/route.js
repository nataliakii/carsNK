import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { withOrderVisibility } from "@/middleware/withOrderVisibility";

async function handler(request, { params }) {
  try {
    await connectToDB();
    const { carId } = params;

    const orders = await Order.find({ car: carId }).lean();
    
    if (orders.length === 0) {
      return new Response("No Orders for this car", { status: 200 });
    }
    
    return new Response(JSON.stringify(orders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response("Failed to fetch orders", { status: 500 });
  }
}

export const GET = withOrderVisibility(handler);
