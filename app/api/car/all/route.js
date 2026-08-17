import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { NextResponse } from "next/server";
import { getCars } from "@/domain/services";

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

export const GET = async () => {
  try {
    const session = await getServerSession(authOptions);
    const cars = await getCars({ session });
    const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.role);
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
export const POST = async () => {
  try {
    const session = await getServerSession(authOptions);
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
