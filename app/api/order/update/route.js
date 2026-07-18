import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
// 🔧 FIXED: Use orderAccessPolicy directly (no legacy shims)
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { ROLE } from "@/domain/orders/admin-rbac";

export const PUT = async (req) => {
  try {
    await connectToDB();
    
    // Check admin authentication
    const { session, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const { _id, phone, email, customerName, my_order, flightNumber, Viber, Whatsapp, Telegram } =
      await req.json(); // Destructure only the allowed fields
    
    // Find the order first to check permissions
    const existingOrder = await Order.findById(_id);
    
    if (!existingOrder) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404 }
      );
    }
    
    // 🔧 FIXED: Check permissions using orderAccessPolicy (SSOT)
    const timeBucket = getTimeBucket(existingOrder);
    const isPast = timeBucket === "PAST";
    const access = getOrderAccess({
      role: session.user.role === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN",
      isClientOrder: existingOrder.my_order === true,
      confirmed: existingOrder.confirmed === true,
      isPast,
      timeBucket,
    });
    
    if (access.isViewOnly) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "У вас нет прав на редактирование этого заказа",
          code: "PERMISSION_DENIED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter the update to only include allowed fields
    const updateFields = {};
    if (phone) updateFields.phone = phone;
    if (email) updateFields.email = email;
    if (customerName) updateFields.customerName = customerName;
    if (typeof my_order === "boolean") updateFields.my_order = my_order;
    // Allow updating flightNumber (accept empty string as a valid value)
    if (flightNumber !== undefined) updateFields.flightNumber = flightNumber;
    if (typeof Viber === "boolean") updateFields.Viber = Viber;
    if (typeof Whatsapp === "boolean") updateFields.Whatsapp = Whatsapp;
    if (typeof Telegram === "boolean") updateFields.Telegram = Telegram;

    // Update the order with only the allowed fields
    const updatedOrder = await Order.findByIdAndUpdate(_id, updateFields, {
      new: true, // return the updated document
    });

    if (!updatedOrder) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(updatedOrder), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response("Failed to update order", { status: 500 });
  }
};
