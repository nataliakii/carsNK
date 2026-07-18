import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCarById } from "@/domain/services";

function getId(paramId) {
  return Array.isArray(paramId) ? paramId[0] : paramId;
}

export const GET = async (request, { params }) => {
  try {
    const id = getId(params.id);
    const session = await getServerSession(authOptions);
    const car = await getCarById(id, { session });
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
