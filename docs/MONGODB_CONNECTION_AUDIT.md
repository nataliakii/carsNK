# MongoDB Connection Usage Audit

**Date:** March 14, 2026  
**Goal:** Identify why MongoDB Atlas connection count is approaching the M0 limit (500 connections)

---

## Executive Summary

**CRITICAL ISSUES FOUND:**
1. ❌ **No global connection cache** - `isConnected` flag is module-scoped, ineffective in serverless
2. ❌ **Every API route calls `connectToDB()`** - No check for existing connection state
3. ❌ **Duplicate database connection files** - `lib/database.js` and `utils/database.js` (identical code)
4. ❌ **Server components trigger HTTP requests** - Each request creates a new connection
5. ⚠️ **No connection state checking** - Doesn't verify `mongoose.connection.readyState` before connecting

**RISK LEVEL:** 🔴 **HIGH** - Connection explosion in serverless/Next.js App Router environment

---

## 1. Connection Initialization Points

### Found `mongoose.connect()` calls:

#### Primary Connection Files:
- **`lib/database.js`** (lines 22) - `mongoose.connect()`
- **`utils/database.js`** (lines 22) - `mongoose.connect()` ⚠️ **DUPLICATE**

Both files contain identical `connectToDB()` functions with the same flawed pattern:
```javascript
let isConnected = false; // ❌ Module-scoped, not global

export const connectToDB = async () => {
  if (isConnected) {
    return; // ❌ Won't work in serverless - fresh module per invocation
  }
  await mongoose.connect(...);
  isConnected = true;
};
```

#### Scripts (acceptable - one-time use):
- `scripts/seedTestingCarField.js` - Uses `new MongoClient()` (fine for scripts)
- `scripts/migrate_childSeats_to_ChildSeats.js` - Uses `new MongoClient()`
- `scripts/migrate_my_order_field.js` - Uses `new MongoClient()`
- `scripts/migrate_secondDriver_field.js` - Uses `new MongoClient()`
- `scripts/migrateCarSlugs.js` - Uses `new MongoClient()`

---

## 2. Global Connection Cache Status

**❌ NO GLOBAL CACHE FOUND**

- No `global.mongoose` usage
- No `global.mongo` usage
- No `globalThis.mongoose` usage
- Connection state is tracked only via module-scoped `isConnected` flag

**Problem:** In Next.js serverless functions (API routes), each invocation gets a fresh module instance, so `isConnected` resets to `false` every time, causing repeated connections.

---

## 3. Connection Usage in API Routes

**Found 30+ API routes calling `connectToDB()`:**

### Routes calling `connectToDB()`:
- `app/api/car/all/route.js` - **Calls TWICE** (GET + POST handlers)
- `app/api/car/add/route.js` - Calls in POST handler
- `app/api/car/addOne/route.js` - Calls in POST handler
- `app/api/car/update/route.js` - Calls in POST handler
- `app/api/car/delete/[carId]/route.js` - Calls in DELETE handler
- `app/api/car/slug/[slug]/route.js` - Calls in GET handler
- `app/api/car/[...id]/route.js` - Calls in GET handler
- `app/api/car/models/route.js` - Calls in GET handler
- `app/api/company/route.js` - **Calls TWICE** (GET handler)
- `app/api/company/[...id]/route.js` - Calls in GET handler
- `app/api/company/buffer/[id]/route.js` - Calls in POST handler
- `app/api/discount/route.js` - **Calls THREE TIMES** (multiple handlers)
- `app/api/order/add/route.js` - Calls in POST handler
- `app/api/order/[carId]/route.js` - Calls in GET handler
- `app/api/order/deleteOne/[orderId]/route.js` - Calls in DELETE handler
- `app/api/order/deleteAll/route.js` - Calls in DELETE handler
- `app/api/order/update/route.js` - Calls in POST handler
- `app/api/order/update/customer/route.js` - Calls in POST handler
- `app/api/order/update/moveCar/route.js` - Calls in POST handler
- `app/api/order/update/switchConfirm/[orderId]/route.js` - Calls in POST handler
- `app/api/order/update/changeDates/route.js` - Calls in POST handler
- `app/api/order/update/[orderId]/route.js` - Calls in POST handler
- `app/api/order/refetch/route.js` - Calls in POST handler
- `app/api/order/refetch/[orderId]/route.js` - Calls in POST handler
- `app/api/order/refetch-active/route.js` - Calls in POST handler
- `app/api/order/calcTotalPrice/route.js` - Calls in POST handler
- `app/api/admin/orders/route.js` - Calls in GET handler
- `app/api/admin/orders/send-confirmation/route.js` - Calls in POST handler
- `app/api/internal/cars/route.ts` - Calls in GET handler

### Middleware:
- `middleware/orderGuard.js` - Calls `connectToDB()` in middleware function

**Total:** ~35+ connection attempts per full request cycle (if multiple routes are hit)

---

## 4. Helper Functions Analysis

### `fetchAllCars()` (utils/action.js:121)
- **Pattern:** Makes HTTP request to `/api/car/all`
- **Impact:** Each call triggers `connectToDB()` in the API route
- **Used in:** Server components, client components, admin pages
- **Risk:** ✅ **LOW** - Uses HTTP, so connection is per API request (expected)

### `fetchCompany()` (utils/action.js:881)
- **Pattern:** Makes HTTP request to `/api/company/[id]`
- **Impact:** Each call triggers `connectToDB()` in the API route
- **Used in:** Server components, client components, admin pages
- **Risk:** ✅ **LOW** - Uses HTTP, so connection is per API request (expected)

### `reFetchActiveOrders()` (utils/action.js:173)
- **Pattern:** Makes HTTP request to `/api/order/refetch-active`
- **Impact:** Each call triggers `connectToDB()` in the API route
- **Used in:** Server components, client components
- **Risk:** ✅ **LOW** - Uses HTTP, so connection is per API request (expected)

**Note:** These helper functions correctly use HTTP requests, so they don't directly create connections. However, they trigger API routes that do.

---

## 5. Server Components Analysis

### Server Components Using MongoDB:
- `app/[locale]/page.js` - Calls `fetchAllCars()`, `reFetchActiveOrders()`, `fetchCompany()` (via HTTP)
- `app/[locale]/cars/[slug]/page.js` - Calls `fetchAllCars()`, `reFetchActiveOrders()`, `fetchCompany()` (via HTTP)
- `app/[locale]/cars/page.js` - Likely calls similar helpers
- `app/[locale]/locations/[[...path]]/page.js` - Likely calls similar helpers
- `app/admin/features/shared/DataLoader.js` - Calls `fetchAllCars()`, `fetchCompany()`, `fetchOrdersForCurrentSession()` (via HTTP)

**Pattern:** Server components use HTTP requests to API routes, which then call `connectToDB()`. This is acceptable architecture, but the API routes themselves have the connection issue.

---

## 6. Connection Reuse Pattern Analysis

### Current Pattern (BROKEN):
```javascript
// lib/database.js & utils/database.js
let isConnected = false; // ❌ Module-scoped

export const connectToDB = async () => {
  if (isConnected) {
    return; // ❌ Always false in serverless
  }
  await mongoose.connect(...);
  isConnected = true;
};
```

### Problems:
1. **Module-scoped variable** - Each serverless invocation gets a fresh module, so `isConnected` is always `false`
2. **No connection state check** - Doesn't check `mongoose.connection.readyState`
3. **No error handling for existing connections** - If connection exists but `isConnected` flag is wrong, will try to reconnect
4. **Duplicate files** - Two identical connection files create confusion

---

## 7. Risk Assessment

### Serverless Environment (Next.js App Router):
- **Risk:** 🔴 **CRITICAL**
- **Reason:** Each API route invocation is a separate serverless function
- **Impact:** Every API request attempts a new connection
- **Connection Count:** Could easily exceed 500 with concurrent requests

### Server Components:
- **Risk:** 🟡 **MEDIUM**
- **Reason:** Server components make HTTP requests to API routes
- **Impact:** Each server component render triggers API route → connection attempt
- **Mitigation:** Server components use HTTP, so they're subject to API route connection issues

### Middleware:
- **Risk:** 🔴 **HIGH**
- **Reason:** `orderGuard.js` calls `connectToDB()` on every request
- **Impact:** Every request through middleware creates a connection attempt
- **Location:** `middleware/orderGuard.js:95`

---

## 8. Recommended Solution

### Option 1: Global Connection Cache (Recommended for Next.js)

Create a single, properly cached connection file:

```javascript
// lib/database.js (consolidate utils/database.js into this)
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

/**
 * Global connection cache for serverless environments
 * Uses globalThis to persist across serverless invocations
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectToDB = async () => {
  // If already connected, return immediately
  if (cached.conn) {
    return cached.conn;
  }

  // If connection is in progress, wait for it
  if (cached.promise) {
    return cached.promise;
  }

  // Check mongoose connection state
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return cached.conn;
  }

  // Start new connection
  cached.promise = mongoose
    .connect(MONGODB_URI, {
      dbName: "Car",
    })
    .then((mongoose) => {
      cached.conn = mongoose;
      cached.promise = null;
      return mongoose;
    })
    .catch((err) => {
      cached.promise = null;
      throw err;
    });

  return cached.promise;
};
```

### Option 2: Connection State Check (Simpler, but less robust)

```javascript
// lib/database.js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

export const connectToDB = async () => {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Check if connection is in progress
  if (mongoose.connection.readyState === 2) {
    // Wait for connection to complete
    await new Promise((resolve) => {
      mongoose.connection.once("connected", resolve);
    });
    return mongoose.connection;
  }

  // Connect
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGODB_URI, {
    dbName: "Car",
  });

  return mongoose.connection;
};
```

---

## 9. Action Items

### Immediate (Critical):
1. ✅ **Consolidate database files** - Remove `utils/database.js`, use only `lib/database.js`
2. ✅ **Implement global connection cache** - Use Option 1 pattern above
3. ✅ **Update all imports** - Change `@utils/database` → `@lib/database` in all files
4. ✅ **Add connection state checking** - Check `mongoose.connection.readyState` before connecting

### Short-term (High Priority):
5. ✅ **Update middleware** - Ensure `orderGuard.js` uses cached connection
6. ✅ **Add connection monitoring** - Log connection attempts to identify leaks
7. ✅ **Review API routes** - Ensure all routes use the cached connection function

### Long-term (Best Practices):
8. ✅ **Add connection pooling configuration** - Set `maxPoolSize` in mongoose.connect options
9. ✅ **Monitor connection count** - Set up alerts for connection count approaching limits
10. ✅ **Consider connection limits** - Configure MongoDB Atlas connection limits appropriately

---

## 10. Connection Pooling Configuration

Add explicit connection pooling options:

```javascript
await mongoose.connect(MONGODB_URI, {
  dbName: "Car",
  maxPoolSize: 10, // Limit concurrent connections per instance
  minPoolSize: 2,  // Maintain minimum connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

**Note:** `maxPoolSize` limits connections per application instance. In serverless, each function is an instance, so this helps but doesn't solve the multiple-instance problem. The global cache (Option 1) is still required.

---

## 11. Testing Recommendations

1. **Load test API routes** - Verify connection count doesn't grow linearly with requests
2. **Monitor MongoDB Atlas** - Check connection count during peak traffic
3. **Test serverless cold starts** - Ensure connections are reused after cold starts
4. **Test concurrent requests** - Verify multiple simultaneous requests don't create multiple connections

---

## Summary

**Root Cause:** Module-scoped `isConnected` flag doesn't work in serverless environments where each invocation gets a fresh module instance.

**Solution:** Implement global connection cache using `global.mongoose` pattern (Option 1) and consolidate duplicate database files.

**Expected Impact:** Reduce connection attempts from ~35+ per request cycle to 1 per serverless function instance (reused across requests).
