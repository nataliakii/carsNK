/**
 * POST /api/order/refetch-active
 *
 * CLIENT-SAFE endpoint — returns orders that are still "active" for the calendar:
 * rentalEndDate >= today (Athens). Visibility applied via service.
 */

import { getActiveOrders } from "@/domain/services";
import { getServerSessionWithViewAs } from "@lib/adminAuth";

export const POST = async (request) => {
  try {
    const session = await getServerSessionWithViewAs(request);
    const orders = await getActiveOrders({ session });
    return new Response(JSON.stringify(orders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching active orders:", error);
    return new Response(`Failed to fetch active orders: ${error.message}`, {
      status: 500,
    });
  }
};
