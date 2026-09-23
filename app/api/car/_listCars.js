/**
 * Shared car-list handlers for /api/car/all and /api/car/getAll.
 * Keep authorization identical: ADMIN scoped to owner; SUPERADMIN full/view-as.
 */
import { NextResponse } from "next/server";
import { getCars } from "@/domain/services";
import { getServerSessionWithViewAs } from "@lib/adminAuth";

export const carListDynamic = "force-dynamic";
export const carListRevalidate = 0;

function carsResponse(cars, { privateCache = false } = {}) {
  const list = Array.isArray(cars) ? cars : [];
  return NextResponse.json(list, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": privateCache
        ? "private, no-store, no-cache, max-age=0, must-revalidate"
        : "public, s-maxage=120, stale-while-revalidate=60",
      Vary: "Cookie",
    },
  });
}

function safeListError(error) {
  console.error("[api/car/list]", error?.name || "Error", error?.message || error);
  return NextResponse.json(
    { success: false, message: "Failed to fetch cars" },
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/** GET — public marketplace filter when not admin; admin sees scoped fleet. */
export async function listCarsGet(request) {
  try {
    const session = await getServerSessionWithViewAs(request);
    const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.role);
    const cars = await getCars({ session, marketplaceOnly: !isAdmin });
    return carsResponse(cars, { privateCache: isAdmin });
  } catch (error) {
    return safeListError(error);
  }
}

/** POST — always fresh list for admin refresh (skipCache). */
export async function listCarsPost(request) {
  try {
    const session = await getServerSessionWithViewAs(request);
    const cars = await getCars({ session });
    return carsResponse(cars, { privateCache: true });
  } catch (error) {
    return safeListError(error);
  }
}
