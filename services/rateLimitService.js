/**
 * rateLimitService.js
 *
 * Rate limiting for POST /api/order/add: per IP or fingerprint, configurable max/window.
 * Logic isolated in this service so route handler stays clean.
 *
 * WHY: Uses MongoDB store so rate limit state is shared across instances (stateless scaling).
 */

import mongoose from "mongoose";
import { RateLimiterMongo } from "rate-limiter-flexible";
import orderGuardConfig from "@config/orderGuard";

let limiterInstance = null;

/**
 * Get or create a single RateLimiterMongo instance (reuse for all requests).
 * Requires MongoDB connection; uses mongoose.connection.getClient() when available.
 *
 * @returns {Promise<import("rate-limiter-flexible").RateLimiterMongo>}
 */
async function getLimiter() {
  if (limiterInstance) {
    return limiterInstance;
  }

  const client =
    (typeof mongoose.connection?.getClient === "function" &&
      mongoose.connection.getClient()) ||
    mongoose.connection?.client;

  if (!client) {
    throw new Error(
      "rateLimitService: MongoDB client not available; ensure connectToDB() was called"
    );
  }

  const dbName = mongoose.connection?.db?.databaseName || "Car";
  const points =
    typeof orderGuardConfig.RATE_LIMIT_MAX === "number"
      ? orderGuardConfig.RATE_LIMIT_MAX
      : parseInt(String(orderGuardConfig.RATE_LIMIT_MAX || "5"), 10);
  const duration =
    typeof orderGuardConfig.RATE_LIMIT_WINDOW_SEC === "number"
      ? orderGuardConfig.RATE_LIMIT_WINDOW_SEC
      : parseInt(String(orderGuardConfig.RATE_LIMIT_WINDOW_SEC || "600"), 10);
  const tableName =
    orderGuardConfig.RATE_LIMIT_COLLECTION || "orderRateLimit";

  limiterInstance = new RateLimiterMongo({
    storeClient: client,
    mongo: client,
    dbName,
    tableName,
    keyPrefix: "order_add",
    points,
    duration,
  });

  return limiterInstance;
}

/**
 * Consume one rate-limit point for the given key (IP or fingerprint).
 * If limit exceeded, throws; otherwise resolves.
 *
 * @param {string} key - Identifier (IP or fingerprint; prefer fingerprint if present for consistency)
 * @returns {Promise<void>}
 */
async function consume(key) {
  if (!key || typeof key !== "string" || !key.trim()) {
    return;
  }

  const limiter = await getLimiter();
  const rlKey = key.trim();

  try {
    await limiter.consume(rlKey);
  } catch (rejRes) {
    if (rejRes && typeof rejRes.remainingPoints === "number" && rejRes.remainingPoints <= 0) {
      const err = new Error("RATE_LIMIT");
      err.remainingPoints = 0;
      err.msBeforeNext = rejRes.msBeforeNext;
      throw err;
    }
    throw rejRes;
  }
}

export { getLimiter, consume };
