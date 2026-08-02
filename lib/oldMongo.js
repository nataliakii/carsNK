/**
 * Native Mongo client for the legacy Natali cluster (car.8uqtk).
 * Optional: if MONGODB_URI_OLD is unset, helpers no-op.
 */

import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB_NAME || "Car";

let cached = global.__oldMongo;
if (!cached) {
  cached = global.__oldMongo = { client: null, promise: null };
}

export function getOldMongoUri() {
  return String(process.env.MONGODB_URI_OLD || "").trim();
}

export function isOldMongoConfigured() {
  return Boolean(getOldMongoUri());
}

/**
 * @returns {Promise<import('mongodb').Db | null>}
 */
export async function getOldDb() {
  const uri = getOldMongoUri();
  if (!uri) return null;

  if (cached.client) {
    return cached.client.db(DB_NAME);
  }

  if (!cached.promise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    cached.promise = client
      .connect()
      .then((c) => {
        cached.client = c;
        return c;
      })
      .catch((err) => {
        cached.promise = null;
        cached.client = null;
        throw err;
      });
  }

  const client = await cached.promise;
  return client.db(DB_NAME);
}
