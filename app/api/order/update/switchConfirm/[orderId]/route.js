import { Order } from "@models/order";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { confirmOrderFlow } from "@/domain/orders/confirmOrderFlow";
import { orderMessages } from "@/domain/messages";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const PATCH = async (request, { params }) => {
  try {
    await connectToDB();

    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    if (!session?.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid session" }),
        { status: 401, headers: JSON_HEADERS }
      );
    }

    const { orderId } = params;
    const order = await Order.findById(orderId);

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    const companyId = session.user.companyId || COMPANY_ID;
    const company = await Company.findById(companyId);
    const bufferHours = company?.bufferTime != null ? Number(company.bufferTime) : undefined;

    const result = await confirmOrderFlow({
      order,
      sessionUser: session.user,
      bufferHours,
      companyEmail: company?.email,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error("Error updating order:", error);

    const company = await Company.findById(COMPANY_ID);
    const bufferHours = company?.bufferTime != null ? Number(company.bufferTime) : undefined;

    const body = {
      success: false,
      data: null,
      message: orderMessages.CONFIRM_TOGGLE_ERROR,
      level: "block",
      conflicts: [],
      affectedOrders: [],
      bufferHours,
    };

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
