import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getAllOrders } from "@/domain/services";

export const POST = async (request) => {
  try {
    const session = await getServerSession(authOptions);
    const orders = await getAllOrders({ session });
    return new Response(JSON.stringify(orders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return new Response(`Failed to fetch orders: ${error.message}`, {
      status: 500,
    });
  }
};
