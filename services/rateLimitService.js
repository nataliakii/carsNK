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

const limiterByName = new Map();

function mongoClient() {
  return (
    (typeof mongoose.connection?.getClient === "function" &&
      mongoose.connection.getClient()) ||
    mongoose.connection?.client
  );
}

function orderLimiterOptions() {
  const points =
    typeof orderGuardConfig.RATE_LIMIT_MAX === "number"
      ? orderGuardConfig.RATE_LIMIT_MAX
      : parseInt(String(orderGuardConfig.RATE_LIMIT_MAX || "5"), 10);
  const duration =
    typeof orderGuardConfig.RATE_LIMIT_WINDOW_SEC === "number"
      ? orderGuardConfig.RATE_LIMIT_WINDOW_SEC
      : parseInt(String(orderGuardConfig.RATE_LIMIT_WINDOW_SEC || "600"), 10);
  return {
    tableName: orderGuardConfig.RATE_LIMIT_COLLECTION || "orderRateLimit",
    keyPrefix: "order_add",
    points,
    duration,
  };
}

/**
 * Get or create a RateLimiterMongo instance for a named collection.
 * Requires MongoDB connection; uses mongoose.connection.getClient() when available.
 *
 * @param {{ tableName?: string, keyPrefix?: string, points?: number, duration?: number }} [options]
 * @returns {Promise<import("rate-limiter-flexible").RateLimiterMongo>}
 */
async function getLimiterFor(options = {}) {
  const tableName = options.tableName || orderLimiterOptions().tableName;
  const keyPrefix = options.keyPrefix || "rl";
  const points =
    typeof options.points === "number"
      ? options.points
      : orderLimiterOptions().points;
  const duration =
    typeof options.duration === "number"
      ? options.duration
      : orderLimiterOptions().duration;
  const cacheKey = `${tableName}:${keyPrefix}:${points}:${duration}`;

  if (limiterByName.has(cacheKey)) {
    return limiterByName.get(cacheKey);
  }

  const client = mongoClient();
  if (!client) {
    throw new Error(
      "rateLimitService: MongoDB client not available; ensure connectToDB() was called"
    );
  }

  const dbName = mongoose.connection?.db?.databaseName || "Car";
  const limiter = new RateLimiterMongo({
    storeClient: client,
    mongo: client,
    dbName,
    tableName,
    keyPrefix,
    points,
    duration,
  });

  limiterByName.set(cacheKey, limiter);
  return limiter;
}

/**
 * Get or create the order-add RateLimiterMongo instance (reuse for all requests).
 *
 * @returns {Promise<import("rate-limiter-flexible").RateLimiterMongo>}
 */
async function getLimiter() {
  return getLimiterFor(orderLimiterOptions());
}

async function consumeWithLimiter(limiter, key) {
  if (!key || typeof key !== "string" || !key.trim()) {
    return;
  }

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

/**
 * Consume one rate-limit point for the given key (IP or fingerprint).
 * If limit exceeded, throws; otherwise resolves.
 *
 * @param {string} key - Identifier (IP or fingerprint; prefer fingerprint if present for consistency)
 * @returns {Promise<void>}
 */
async function consume(key) {
  const limiter = await getLimiter();
  await consumeWithLimiter(limiter, key);
}

/**
 * Consume one point on a named limiter (contact, transfers, …).
 *
 * @param {string} key
 * @param {{ tableName: string, keyPrefix?: string, points?: number, duration?: number }} options
 * @returns {Promise<void>}
 */
async function consumeFor(key, options) {
  const limiter = await getLimiterFor(options || {});
  await consumeWithLimiter(limiter, key);
}

export { getLimiter, getLimiterFor, consume, consumeFor };
