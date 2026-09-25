"use server";

import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { verifyCustomerProblemToken } from "@/domain/orders/customerProblemToken";
import { reportBookingProblem } from "@/domain/orders/closeCompletedRentals";

export async function submitCustomerProblemReport(token) {
  const verified = verifyCustomerProblemToken(token);
  if (!verified.ok) return { ok: false };
  await connectToDB();
  const order = await Order.findById(verified.orderId);
  if (!order) return { ok: false };
  const marked = reportBookingProblem(order, { by: "customer" });
  if (!marked.ok) return { ok: false };
  await order.save();
  return { ok: true };
}
