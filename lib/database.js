import mongoose from "mongoose";

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
    mongoose.set("strictQuery", true);
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: "Car",
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
      })
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
