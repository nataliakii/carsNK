/**
 * withOrderVisibility.js
 * 
 * ЕДИНСТВЕННАЯ точка применения visibility.
 * Применяется ТОЛЬКО к READ-роутам.
 * 
 * WRITE-роуты НЕ ЗНАЮТ о visibility.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import {
  applyVisibilityToOrder,
  applyVisibilityToOrders,
} from "@/domain/orders/orderVisibility";

/**
 * Middleware для применения visibility к ответу.
 * 
 * Поддерживает форматы:
 * - Order[] — массив заказов
 * - { orders: Order[] } — объект с вложенными заказами (Car)
 * - { data: Order[] } — ответ с data полем
 * - Single Order — одиночный заказ
 */
export function withOrderVisibility(handler) {
  return async (req, ctx) => {
    // Получаем session ДО вызова handler
    const session = await getServerSession(authOptions);
    const user = session?.user || null;

    // Вызываем оригинальный handler
    const res = await handler(req, ctx);

    // Если не Response — не трогаем
    if (!(res instanceof Response)) return res;

    // Если не JSON — не трогаем
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return res;

    // Парсим JSON
    let data;
    try {
      data = await res.json();
    } catch {
      return res;
    }

    let filtered = data;

    // Order[] — массив заказов напрямую
    if (Array.isArray(data)) {
      filtered = applyVisibilityToOrders(data, user);
    }
    // { data: Order[] } — ответ API с data полем
    else if (data?.data && Array.isArray(data.data)) {
      filtered = {
        ...data,
        data: applyVisibilityToOrders(data.data, user),
      };
    }
    // { orders: Order[] } — Car с вложенными заказами
    else if (data?.orders && Array.isArray(data.orders)) {
      filtered = {
        ...data,
        orders: applyVisibilityToOrders(data.orders, user),
      };
    }
    // Single order — объект с _id и my_order
    else if (data?._id && "my_order" in data) {
      filtered = applyVisibilityToOrder(data, user);
    }

    // Возвращаем новый Response с отфильтрованными данными
    return new Response(JSON.stringify(filtered), {
      status: res.status,
      headers: res.headers,
    });
  };
}
