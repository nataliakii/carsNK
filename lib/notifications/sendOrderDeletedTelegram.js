/**
 * Сервер-only: Telegram при удалении заказа (не импортировать из client/utils/action).
 */

import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { connectToDB } from "@lib/database";
import {
  resolveNotifyLanguagesFromCompanyDoc,
  formatOrderDeletedTelegramMessage,
} from "@/domain/orders/adminNotifyLocales";
import { withTestOrderTelegramMessage } from "@/domain/orders/testOrderMarkers";

function validateOrderForTelegram(order) {
  if (!order || typeof order !== "object") {
    return "Order must be a non-null object";
  }
  if (order.id === undefined || order.id === null) {
    return "Order is missing required field: id";
  }
  if (!order.startDate || typeof order.startDate !== "string") {
    return "Order is missing or has invalid field: startDate";
  }
  if (!order.endDate || typeof order.endDate !== "string") {
    return "Order is missing or has invalid field: endDate";
  }
  if (typeof order.totalPrice !== "number" || isNaN(order.totalPrice)) {
    return "Order is missing or has invalid field: totalPrice";
  }
  if (!order.currency || typeof order.currency !== "string") {
    return "Order is missing or has invalid field: currency";
  }
  if (!order.customer || typeof order.customer !== "object") {
    return "Order is missing required field: customer";
  }
  if (!order.customer.name || typeof order.customer.name !== "string") {
    return "Order customer is missing required field: name";
  }
  return null;
}

/**
 * @param {Object} order — см. deleteOne route
 * @param {string} deletedBy
 * @returns {Promise<boolean>}
 */
export async function sendOrderDeletedTelegramNotification(order, deletedBy) {
  const validationError = validateOrderForTelegram(order);
  if (validationError) {
    console.error("[Telegram] Order deleted notification failed:", validationError);
    return false;
  }
  if (!deletedBy || typeof deletedBy !== "string" || deletedBy.trim() === "") {
    console.error(
      "[Telegram] Order deleted notification failed: deletedBy is required"
    );
    return false;
  }

  let locale = "en";
  try {
    await connectToDB();
    const doc = await Company.findById(COMPANY_ID)
      .select("langAdmin langSuperadmin language locale notifyLanguage")
      .lean();
    locale = resolveNotifyLanguagesFromCompanyDoc(doc).langSuperadmin;
  } catch (e) {
    console.warn(
      "[Telegram] Order deleted: could not load notify locales:",
      e?.message
    );
  }

  const message = withTestOrderTelegramMessage(
    formatOrderDeletedTelegramMessage(order, deletedBy, locale),
    order.fromLocalhost === true
  );
  return await sendTelegramDirect(message);
}
