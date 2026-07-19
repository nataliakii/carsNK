import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@lib/adminAuth";
import { createOfflineOrderStub } from "@/domain/orders/createOfflineOrderStub";

export const runtime = "nodejs";

/**
 * POST /api/order/addBulk
 * Body: { orders: object[] } — each row is an offline stub.
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const orders = Array.isArray(body?.orders) ? body.orders : null;
  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { success: false, message: "orders array is required" },
      { status: 400 }
    );
  }
  if (orders.length > 50) {
    return NextResponse.json(
      { success: false, message: "Max 50 orders per bulk request" },
      { status: 400 }
    );
  }

  await connectToDB();

  const created = [];
  const errors = [];

  for (let i = 0; i < orders.length; i += 1) {
    const result = await createOfflineOrderStub(orders[i], {
      user: session.user,
    });
    if (result.ok) {
      created.push({ index: i, ...result.order });
    } else {
      errors.push({
        index: i,
        error: result.error,
        customerName: orders[i]?.customerName,
      });
    }
  }

  if (created.length > 0) {
    revalidateTag("orders");
    revalidatePath("/admin/orders-calendar");
  }

  return NextResponse.json(
    {
      success: errors.length === 0,
      created,
      errors,
      message:
        errors.length === 0
          ? `Created ${created.length} offline order(s)`
          : `Created ${created.length}, failed ${errors.length}`,
    },
    { status: created.length > 0 ? 201 : 400 }
  );
}
