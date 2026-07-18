import mongoose from "mongoose";
import { Order } from "@models/order";
import { Car } from "@models/car";
import { PriceBreakdown } from "@models/PriceBreakdown";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { ROLE } from "@/domain/orders/admin-rbac";
import { sendOrderDeletedTelegramNotification } from "@/lib/notifications/sendOrderDeletedTelegram";
import { deleteOrderCloudinaryAssets } from "@/domain/orders/deleteOrderCloudinaryAssets";

export const DELETE = async (request, { params }) => {
  try {
    await connectToDB();

    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { orderId } = params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return new Response(JSON.stringify({ message: "Invalid order id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const orderToDelete = await Order.findById(orderId);

    if (!orderToDelete) {
      return new Response(JSON.stringify({ message: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const timeBucket = getTimeBucket(orderToDelete);
    const isPast = timeBucket === "PAST";
    const access = getOrderAccess({
      role: session.user.role === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN",
      isClientOrder: orderToDelete.my_order === true,
      confirmed: orderToDelete.confirmed === true,
      isPast,
      timeBucket,
    });

    if (!access.canDelete) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "У вас нет прав на удаление этого заказа",
          code: "PERMISSION_DENIED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const orderObjectId = orderToDelete._id;
    const carOfTheOrder = orderToDelete.car
      ? await Car.findById(orderToDelete.car).select("model regNumber orders")
      : null;

    // 1) Remove order ref from car.orders (atomic $pull; fixes broken filter on ObjectId[])
    if (orderToDelete.car) {
      await Car.updateOne(
        { _id: orderToDelete.car },
        { $pull: { orders: orderObjectId } }
      );
    }

    // 2) Drop this order from every other order’s conflict list (both directions)
    await Order.updateMany(
      { hasConflictDates: orderObjectId },
      { $pull: { hasConflictDates: orderObjectId } }
    );

    // 3) Delete stored price breakdown for this order
    await PriceBreakdown.deleteMany({ order: orderObjectId });

    sendOrderDeletedTelegramNotification(
      {
        id: orderToDelete.orderNumber || orderToDelete._id,
        startDate: orderToDelete.rentalStartDate.toISOString(),
        endDate: orderToDelete.rentalEndDate.toISOString(),
        totalPrice: orderToDelete.totalPrice,
        currency: "EUR",
        fromLocalhost: orderToDelete.fromLocalhost === true,
        car: {
          model: carOfTheOrder?.model ?? "—",
          regNumber: carOfTheOrder?.regNumber ?? "—",
        },
        customer: {
          name: orderToDelete.customerName,
          phone: orderToDelete.phone,
          email: orderToDelete.email,
        },
      },
      session.user?.email || session.user?.name || "admin"
    ).catch(() => {});

    try {
      const snap =
        typeof orderToDelete.toObject === "function"
          ? orderToDelete.toObject()
          : orderToDelete;
      await deleteOrderCloudinaryAssets(snap);
    } catch (cloudErr) {
      console.error(
        "[order deleteOne] Cloudinary asset cleanup failed:",
        cloudErr?.message || cloudErr
      );
    }

    await Order.findByIdAndDelete(orderObjectId);

    return new Response(
      JSON.stringify({
        message: `Order with id ${orderId} deleted successfully`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deleting order:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
