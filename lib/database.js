import dns from "dns";
import mongoose from "mongoose";

import { assertTestDatabaseIsolation } from "@/domain/legal/environmentDbGuard";

/**
 * Global connection cache for serverless (Next.js API routes).
 * global object persists across invocations, so we reuse one connection per instance.
 *
 * IMPORTANT: do not throw at module load — Next.js imports route modules during
 * `collecting page data` / build, when env vars may be absent.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Opt-in IPv4 preference for environments where mongodb+srv IPv6 SRV lookup
 * fails (e.g. some local sandboxes). Do NOT enable in production by default —
 * Atlas dual-stack / IPv6 is normal. Set MONGODB_FORCE_IPV4=true only when needed.
 */
function shouldForceMongoIpv4() {
  return String(process.env.MONGODB_FORCE_IPV4 || "").trim().toLowerCase() === "true";
}

let ipv4DnsApplied = false;
function applyMongoIpv4DnsPreference() {
  if (ipv4DnsApplied || !shouldForceMongoIpv4()) return;
  try {
    dns.setDefaultResultOrder("ipv4first");
    ipv4DnsApplied = true;
  } catch {
    // Node < 17
  }
}

function getMongoUri() {
  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) {
    throw new Error(
      "Please define MONGODB_URI in the environment (.env.local or Vercel env)"
    );
  }
  return uri;
}

/**
 * Build mongoose.connect options. Exported for unit tests.
 * Never logs the URI.
 */
export function buildMongoConnectOptions() {
  const opts = {
    dbName: String(process.env.MONGODB_DB_NAME || "Car").trim() || "Car",
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  };
  if (shouldForceMongoIpv4()) {
    // Narrow: only the Mongo driver family option when explicitly requested.
    opts.family = 4;
  }
  return opts;
}

/**
 * Connect to MongoDB. Reuses existing connection when available.
 * @returns {Promise<mongoose.Mongoose>}
 */
export async function connectToDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (!cached.promise) {
    const MONGODB_URI = getMongoUri();
    const connectOpts = buildMongoConnectOptions();
    // Fail closed: Jest/Playwright must never touch a non-test database.
    assertTestDatabaseIsolation({
      uri: MONGODB_URI,
      dbName: connectOpts.dbName,
    });
    applyMongoIpv4DnsPreference();
    mongoose.set("strictQuery", true);
    cached.promise = mongoose
      .connect(MONGODB_URI, connectOpts)
      .then((conn) => {
        cached.conn = conn;
        return conn;
      })
      .catch((error) => {
        // Allow the next request to retry (do not keep a rejected promise forever).
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export { connectToDB as connectDB };
export default connectToDB;
