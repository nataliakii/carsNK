import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { withOrderVisibility } from "@/middleware/withOrderVisibility";
import { ensureOrdersPulledFromOldDb } from "@/domain/sync/oldOrdersSync";
import { getServerSessionWithViewAs } from "@lib/adminAuth";
import { buildOrdersOwnerFilter } from "@/domain/owners/ownerScope";
import { ROLE } from "@models/user";
import {
  isInternalBooking,
  isPlatformBooking,
  summarizeContractorAdminTotals,
} from "@/domain/admin/rovaroContractorAdmin";

/**
 * GET /api/admin/orders
 * 
 * Returns all orders for admin table view.
 * Requires admin authentication.
 * Visibility filtering applied via middleware.
 */
async function handler(request) {
  try {
    const session = await getServerSessionWithViewAs(request);
    
    if (!session || !session.user?.isAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Unauthorized: Admin access required" 
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    await connectToDB();
    await ensureOrdersPulledFromOldDb();

    const adminRole = session.user?.role ?? 0;
    const ownerFilter = buildOrdersOwnerFilter(session);

    const orders = await Order.find(ownerFilter)
      .populate({
        path: "car",
        select: "_id model regNumber carNumber",
      })
      .sort({ createdAt: -1 })
      .lean();

    const sourceQuery = String(
      new URL(request.url).searchParams.get("source") || ""
    ).toLowerCase();
    const isSuper = Number(session.user?.role) === ROLE.SUPERADMIN;
    let visible = orders;
    if (isSuper) {
      if (sourceQuery === "internal") {
        visible = orders.filter((order) => isInternalBooking(order));
      } else if (sourceQuery === "all" || sourceQuery === "support") {
        visible = orders;
      } else {
        visible = orders.filter((order) => isPlatformBooking(order));
      }
    }

    const formattedOrders = visible.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      car: order.car
        ? {
            _id: order.car._id,
            model: order.car.model,
            regNumber: order.car.regNumber,
            carNumber: order.car.carNumber,
          }
        : null,
      carModel: order.carModel,
      carNumber: order.carNumber,
      regNumber: order.regNumber || order.car?.regNumber || "",
      customerName: order.customerName,
      phone: order.phone,
      email: order.email || "",
      secondDriver: order.secondDriver ?? false,
      Viber: order.Viber ?? false,
      Whatsapp: order.Whatsapp ?? false,
      Telegram: order.Telegram ?? false,
      rentalStartDate: order.rentalStartDate,
      rentalEndDate: order.rentalEndDate,
      timeIn: order.timeIn,
      timeOut: order.timeOut,
      confirmed: order.confirmed,
      companyEmailDecision: order.companyEmailDecision || null,
      companyEmailDecisionAt: order.companyEmailDecisionAt || null,
      partnerConfirmedAt: order.partnerConfirmedAt || null,
      partnerConfirmedByEmail: order.partnerConfirmedByEmail || "",
      partnerConfirmMeta: order.partnerConfirmMeta || null,
      declineReason: order.declineReason || "",
      declinedAt: order.declinedAt || null,
      declinedByEmail: order.declinedByEmail || "",
      bookingStatus: order.bookingStatus || "",
      payment: order.payment
        ? { status: order.payment.status || "" }
        : null,
      status: order.status,
      my_order: order.my_order,
      source: order.source || null,
      blocksAvailability: order.blocksAvailability !== false,
      bookingMode: order.bookingMode || "",
      authoritativePrice: order.authoritativePrice || null,
      hasProblem: order.hasProblem === true,
      problemReportedAt: order.problemReportedAt || null,
      supplierRemainingPaidAt: order.supplierRemainingPaidAt || null,
      hasDrivingLicence:
        Array.isArray(order.drivingLicenceUrls) &&
        order.drivingLicenceUrls.length > 0,
      createdByRole: order.createdByRole ?? 0,
      createdByAdminId: order.createdByAdminId || null,
      totalPrice: order.totalPrice,
      OverridePrice: order.OverridePrice ?? null,
      pricingDrift: order.pricingDrift ?? null,
      numberOfDays: order.numberOfDays,
      insurance: order.insurance || "TPL",
      ChildSeats: order.ChildSeats ?? 0,
      franchiseOrder: order.franchiseOrder ?? 0,
      flightNumber: order.flightNumber || "",
      placeIn: order.placeIn,
      placeOut: order.placeOut,
      placeInDetail: order.placeInDetail || "",
      placeOutDetail: order.placeOutDetail || "",
      createdAt: order.createdAt || order.date,
      updatedAt: order.updatedAt,
      hasConflictDates: order.hasConflictDates || [],
      IsConfirmedEmailSent: order.IsConfirmedEmailSent ?? false,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: formattedOrders,
        count: formattedOrders.length,
        totals: summarizeContractorAdminTotals(visible),
        adminRole,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to fetch orders",
        error: error.message,
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export const GET = withOrderVisibility(handler);
