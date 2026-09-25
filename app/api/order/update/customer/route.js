import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
// 🔧 FIXED: Use orderAccessPolicy directly (no legacy shims)
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { ROLE } from "@/domain/orders/admin-rbac";
import { orderOwnershipResponse } from "@/domain/orders/orderOwnershipGuard";
import { parseCustomerPhone } from "@/domain/validation/customerPhone";
import {
  parseOptionalCustomerEmail,
  parseRequiredCustomerEmail,
} from "@/domain/validation/customerEmail";

export const PUT = async (req) => {
  try {
    await connectToDB();
    
    // Check admin authentication
    const { session, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const { _id, phone, email, customerName, flightNumber, Viber, Whatsapp, Telegram } = await req.json(); // Destructure only the allowed fields

    // Debug log to verify incoming payload (including flightNumber)
    console.log("API:update/customer - incoming payload:", {
      _id,
      phone,
      email,
      customerName,
      flightNumber,
      Viber,
      Whatsapp,
      Telegram,
    });
    
    // Find the order first to check permissions
    const existingOrder = await Order.findById(_id);
    
    if (!existingOrder) {
      return new Response(JSON.stringify({ message: "Заказ не найден" }), {
        status: 404,
        success: false,
      });
    }

    // Role and state are not company scope: check whose booking this is.
    const foreign = orderOwnershipResponse(session.user, existingOrder);
    if (foreign) return foreign;
    
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
    if (phone !== undefined && phone !== null) {
      const phoneResult = parseCustomerPhone(phone, {
        required: false,
        skipFormat: Boolean(existingOrder.offline),
      });
      if (!phoneResult.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Некорректный номер телефона",
            code: "INVALID_PHONE",
            messageKey: phoneResult.messageKey,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (existingOrder.offline || phoneResult.phone) {
        updateFields.phone = phoneResult.phone;
      }
    }
    const emailResult = existingOrder.offline
      ? parseOptionalCustomerEmail(email)
      : parseRequiredCustomerEmail(email);
    if (!emailResult.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: emailResult.message,
          code: emailResult.code === "required" ? "EMAIL_REQUIRED" : "INVALID_EMAIL",
          messageKey: emailResult.messageKey,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    updateFields.email = emailResult.email;
    if (customerName) updateFields.customerName = customerName;
    // Allow updating flightNumber (accept empty string as valid)
    if (flightNumber !== undefined) updateFields.flightNumber = flightNumber;
    if (typeof Viber === "boolean") updateFields.Viber = Viber;
    if (typeof Whatsapp === "boolean") updateFields.Whatsapp = Whatsapp;
    if (typeof Telegram === "boolean") updateFields.Telegram = Telegram;

    // Update the order with only the allowed fields
    const updatedOrder = await Order.findByIdAndUpdate(_id, updateFields, {
      new: true, // return the updated document
    });

    if (!updatedOrder) {
      return new Response(JSON.stringify({ message: "Заказ не найден" }), {
        status: 404,
        success: false,
      });
    }

    return new Response(
      JSON.stringify({
        updatedOrder,
        message: "Данные клиента обновлены успешно",
      }),
      {
        status: 200,
        success: true,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Ошибка. Данные клиента не обновлены" }),
      { status: 500, success: false }
    );
  }
};
