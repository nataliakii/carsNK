/**
 * orderAbuseService.js
 *
 * Suspicious behavior detection for order creation:
 * - Multiple identical order payloads in a short time
 * - Too many conflicts or failed attempts
 *
 * WHY: Isolated from order logic; creates auto-ban when thresholds are exceeded.
 */

import mongoose from "mongoose";
import orderGuardConfig from "@config/orderGuard";
import { createAutoBan } from "./banService";

const ABUSE_ATTEMPTS_COLLECTION =
  orderGuardConfig.ABUSE_ATTEMPTS_COLLECTION || "orderAttempts";
const ABUSE_WINDOW_SEC =
  typeof orderGuardConfig.ABUSE_WINDOW_SEC === "number"
    ? orderGuardConfig.ABUSE_WINDOW_SEC
    : parseInt(String(orderGuardConfig.ABUSE_WINDOW_SEC || "900"), 10);
const ABUSE_IDENTICAL_PAYLOAD_MAX =
  typeof orderGuardConfig.ABUSE_IDENTICAL_PAYLOAD_MAX === "number"
    ? orderGuardConfig.ABUSE_IDENTICAL_PAYLOAD_MAX
    : parseInt(String(orderGuardConfig.ABUSE_IDENTICAL_PAYLOAD_MAX || "3"), 10);
const ABUSE_FAILED_ATTEMPTS_MAX =
  typeof orderGuardConfig.ABUSE_FAILED_ATTEMPTS_MAX === "number"
    ? orderGuardConfig.ABUSE_FAILED_ATTEMPTS_MAX
    : parseInt(String(orderGuardConfig.ABUSE_FAILED_ATTEMPTS_MAX || "10"), 10);

function getCollection() {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error(
      "orderAbuseService: MongoDB connection not available; ensure connectToDB() was called"
    );
  }
  return db.collection(ABUSE_ATTEMPTS_COLLECTION);
}

let orderAttemptsIndexesCreated = false;

/**
 * Create indexes on orderAttempts at first use so countDocuments by window doesn't DOS the DB.
 * WHY: Without indexes, queries by payloadHash/ip/fingerprint + createdAt are full collection scans.
 */
async function ensureOrderAttemptsIndexes() {
  if (orderAttemptsIndexesCreated) return;
  try {
    const col = getCollection();
    await col.createIndex({ payloadHash: 1, createdAt: -1 });
    await col.createIndex({ ip: 1, createdAt: -1 });
    await col.createIndex({ fingerprint: 1, createdAt: -1 });
    orderAttemptsIndexesCreated = true;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("orderAbuseService: ensureOrderAttemptsIndexes failed", err);
    }
  }
}

/** Normalize phone for hashing: digits only, so "+30 699..." and "699..." match. */
function normalizePhone(p) {
  if (p == null) return "";
  return String(p).replace(/\D/g, "");
}

/**
 * Stable hash of order payload for "identical payload" detection.
 * Uses a small set of fields; strings are trimmed and lowercased so " John " === "John".
 * Phone is normalized (digits only) so "+30 699..." === "699...".
 *
 * @param {Object} body - Parsed request body (order payload)
 * @returns {string}
 */
function payloadHash(body) {
  if (!body || typeof body !== "object") {
    return "empty";
  }
  const carNumber =
    body.carNumber != null
      ? String(body.carNumber).trim().toLowerCase()
      : "";
  const rentalStartDate =
    body.rentalStartDate != null ? String(body.rentalStartDate).trim() : "";
  const rentalEndDate =
    body.rentalEndDate != null ? String(body.rentalEndDate).trim() : "";
  const timeIn =
    body.timeIn != null ? String(body.timeIn).trim() : "";
  const timeOut =
    body.timeOut != null ? String(body.timeOut).trim() : "";
  const customerName =
    body.customerName != null
      ? String(body.customerName).trim().toLowerCase()
      : "";
  const phone = normalizePhone(body.phone);
  const parts = [
    carNumber,
    rentalStartDate,
    rentalEndDate,
    timeIn,
    timeOut,
    customerName,
    phone,
  ];
  return parts.join("|");
}

/**
 * Check if this request is suspicious BEFORE calling the order controller:
 * same payload (same hash) sent too many times in the window from this IP/fingerprint.
 * If suspicious, creates auto-ban and returns { suspicious: true }.
 *
 * @param {string} [ip]
 * @param {string} [fingerprint]
 * @param {string} payloadHashValue - From payloadHash(body)
 * @returns {Promise<{ suspicious: boolean }>}
 */
async function checkSuspiciousBefore(ip, fingerprint, payloadHashValue) {
  if (!payloadHashValue || (!ip && !fingerprint)) {
    return { suspicious: false };
  }

  const col = getCollection();
  const since = new Date(Date.now() - ABUSE_WINDOW_SEC * 1000);

  const query = {
    payloadHash: payloadHashValue,
    createdAt: { $gte: since },
  };

  const orClause = [];
  if (ip && ip.trim()) orClause.push({ ip: ip.trim() });
  if (fingerprint && fingerprint.trim())
    orClause.push({ fingerprint: fingerprint.trim() });
  if (orClause.length) query.$or = orClause;

  const count = await col.countDocuments(query);

  if (count >= ABUSE_IDENTICAL_PAYLOAD_MAX) {
    await createAutoBan({
      ip: ip && ip.trim() ? ip : undefined,
      fingerprint: fingerprint && fingerprint.trim() ? fingerprint : undefined,
      reason: "Identical order payload repeated",
    });
    return { suspicious: true };
  }

  return { suspicious: false };
}

/**
 * Record one attempt after the controller has run (for "too many failures" detection).
 * If failures in window exceed threshold, creates auto-ban for next request.
 *
 * @param {string} [ip]
 * @param {string} [fingerprint]
 * @param {string} payloadHashValue
 * @param {string} outcome - "success" | "conflict" | "error"
 */
async function recordAttempt(ip, fingerprint, payloadHashValue, outcome) {
  if (!payloadHashValue || (!ip && !fingerprint)) {
    return;
  }

  const col = getCollection();
  const doc = {
    ip: ip && ip.trim() ? ip.trim() : null,
    fingerprint:
      fingerprint && fingerprint.trim() ? fingerprint.trim() : null,
    payloadHash: payloadHashValue,
    outcome: outcome === "success" || outcome === "conflict" || outcome === "error" ? outcome : "error",
    createdAt: new Date(),
  };
  await col.insertOne(doc);

  const isFailure = outcome === "conflict" || outcome === "error";
  if (!isFailure) {
    return;
  }

  const since = new Date(Date.now() - ABUSE_WINDOW_SEC * 1000);
  const orClause = [];
  if (doc.ip) orClause.push({ ip: doc.ip });
  if (doc.fingerprint) orClause.push({ fingerprint: doc.fingerprint });
  const failureCount = await col.countDocuments({
    $or: orClause,
    outcome: { $in: ["conflict", "error"] },
    createdAt: { $gte: since },
  });

  if (failureCount >= ABUSE_FAILED_ATTEMPTS_MAX) {
    await createAutoBan({
      ip: doc.ip || undefined,
      fingerprint: doc.fingerprint || undefined,
      reason: "Too many failed or conflicting order attempts",
    });
  }
}

export {
  payloadHash,
  checkSuspiciousBefore,
  recordAttempt,
  ensureOrderAttemptsIndexes,
};
