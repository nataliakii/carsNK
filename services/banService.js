/**
 * banService.js
 *
 * Ban check and auto-ban creation for order creation guard.
 * Isolated from order business logic: only checks/creates bans by IP and fingerprint.
 *
 * WHY: Bans are stored in MongoDB so all instances see the same state (stateless scaling).
 */

import { Ban } from "@models/Ban";
import orderGuardConfig from "@config/orderGuard";

/**
 * Find an active ban for the given IP and/or fingerprint.
 * Active = (expiresAt is null) OR (expiresAt > now).
 *
 * @param {string} [ip] - Client IP (optional)
 * @param {string} [fingerprint] - Client fingerprint from x-client-id (optional)
 * @returns {Promise<{ banned: boolean, ban?: { reason: string, expiresAt: Date | null } }>}
 */
async function checkBan(ip, fingerprint) {
  if (!ip && !fingerprint) {
    return { banned: false };
  }

  const now = new Date();
  const conditions = [];

  if (ip && typeof ip === "string" && ip.trim()) {
    conditions.push({
      ip: ip.trim(),
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  }
  if (fingerprint && typeof fingerprint === "string" && fingerprint.trim()) {
    conditions.push({
      fingerprint: fingerprint.trim(),
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  }

  if (conditions.length === 0) {
    return { banned: false };
  }

  const ban = await Ban.findOne({ $or: conditions })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  if (!ban) {
    return { banned: false };
  }

  return {
    banned: true,
    ban: {
      reason: ban.reason || "Banned",
      expiresAt: ban.expiresAt || null,
    },
  };
}

/**
 * Create an automatic ban (short-lived). Used when suspicious activity is detected.
 * At least one of ip or fingerprint must be set.
 *
 * @param {Object} opts
 * @param {string} [opts.ip]
 * @param {string} [opts.fingerprint]
 * @param {string} [opts.reason] - Default: "Suspicious activity"
 * @returns {Promise<import("mongoose").Document>}
 */
async function createAutoBan(opts = {}) {
  const { ip, fingerprint, reason } = opts;
  if (!ip && !fingerprint) {
    throw new Error("createAutoBan: at least one of ip or fingerprint is required");
  }

  const durationSec =
    typeof orderGuardConfig.AUTO_BAN_DURATION_SEC === "number"
      ? orderGuardConfig.AUTO_BAN_DURATION_SEC
      : parseInt(orderGuardConfig.AUTO_BAN_DURATION_SEC || "3600", 10);

  const expiresAt =
    durationSec > 0 ? new Date(Date.now() + durationSec * 1000) : null;

  const doc = await Ban.create({
    ip: ip && typeof ip === "string" ? ip.trim() || null : null,
    fingerprint:
      fingerprint && typeof fingerprint === "string"
        ? fingerprint.trim() || null
        : null,
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : "Suspicious activity",
    type: "auto",
    expiresAt,
  });

  return doc;
}

export { checkBan, createAutoBan };
