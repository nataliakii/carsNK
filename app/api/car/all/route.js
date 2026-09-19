import { NextResponse } from "next/server";
import { getCars } from "@/domain/services";
import { getServerSessionWithViewAs } from "@lib/adminAuth";

// Session-dependent listing — never publicly cache (admins must see inactive cars).
export const dynamic = "force-dynamic";
export const revalidate = 0;

function carsResponse(cars, { privateCache = false } = {}) {
  return NextResponse.json(cars, {
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

export const GET = async (request) => {
  try {
    const session = await getServerSessionWithViewAs(request);
    const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.role);
    const cars = await getCars({ session, marketplaceOnly: !isAdmin });
    return carsResponse(cars, { privateCache: isAdmin });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch cars" },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// POST: always fresh (admin refresh / skipCache)
export const POST = async (request) => {
  try {
    const session = await getServerSessionWithViewAs(request);
    const cars = await getCars({ session });
    return carsResponse(cars, { privateCache: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch cars" },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
