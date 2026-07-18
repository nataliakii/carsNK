import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { NextResponse } from "next/server";
import { getCars } from "@/domain/services";

// Кеширование для статических данных (cars меняются редко)
// Revalidate каждые 10 минут (600 секунд)
export const revalidate = 600;

export const GET = async (request) => {
  try {
    const session = await getServerSession(authOptions);
    const cars = await getCars({ session });
    return NextResponse.json(cars, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
      },
    });
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

// POST запросы не кешируются (для обновления данных)
export const POST = async (request) => {
  try {
    const session = await getServerSession(authOptions);
    const cars = await getCars({ session });
    return NextResponse.json(cars, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
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
