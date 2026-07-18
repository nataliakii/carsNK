import { NextResponse } from "next/server";
import { getCompany } from "@/domain/services";

// Кеширование для статических данных (company меняется очень редко)
// Revalidate каждый час (3600 секунд)
export const revalidate = 3600;

export const GET = async (request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    const company = await getCompany(id);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(company, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("Error retrieving company:", error);
    return NextResponse.json(
      { error: `Failed to retrieve company: ${error.message}` },
      { status: 500 }
    );
  }
};
