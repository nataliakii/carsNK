import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { applySupplierResponse } from "@/domain/orders/supplierResponse";
import { validateSupplierResponsePayload } from "@/domain/orders/supplierResponseStatus";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function PATCH(request, { params }) {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = validateSupplierResponsePayload(body);
    if (!parsed.ok) {
      return new Response(
        JSON.stringify({ success: false, message: parsed.message }),
        { status: parsed.status, headers: JSON_HEADERS }
      );
    }

    const { orderId } = params;
    const result = await applySupplierResponse({
      orderId,
      sessionUser: session.user,
      response: parsed.response,
      reason: parsed.reason,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error("[supplier-response]", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to save supplier response",
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
