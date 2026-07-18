import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCarBySlug } from "@/domain/services";

export const GET = async (request, { params }) => {
  try {
    const slug = params.slug;
    if (!slug) {
      return new Response("Slug required", { status: 400 });
    }
    const session = await getServerSession(authOptions);
    const car = await getCarBySlug(slug, { session });
    if (!car) {
      return new Response("Car not found", { status: 404 });
    }
    return new Response(JSON.stringify(car), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response("Failed to fetch car", { status: 500 });
  }
};
