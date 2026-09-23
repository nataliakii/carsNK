import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCarById } from "@/domain/services";
import mongoose from "mongoose";
import { listCarsGet } from "../_listCars";

function getId(paramId) {
  return Array.isArray(paramId) ? paramId[0] : paramId;
}

function isValidObjectId(id) {
  const raw = String(id || "").trim();
  return Boolean(raw) && mongoose.Types.ObjectId.isValid(raw);
}

/** Reserved path segments that must never be treated as car ObjectIds. */
const LIST_ALIASES = new Set(["getAll", "all", "list"]);

export const GET = async (request, { params }) => {
  try {
    const id = getId(params.id);
    const segment = String(id || "").trim();

    // Belt-and-suspenders: if a catch-all still receives list aliases
    // (stale routing / proxy), serve the car list instead of CastError 500.
    if (LIST_ALIASES.has(segment)) {
      return listCarsGet(request);
    }

    if (!isValidObjectId(segment)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid car id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const session = await getServerSession(authOptions);
    const car = await getCarById(segment, { session });
    if (!car) {
      return new Response(
        JSON.stringify({ success: false, message: "Car not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(JSON.stringify(car), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      "[api/car/[id]]",
      error?.name || "Error",
      error?.message || error
    );
    return new Response(
      JSON.stringify({ success: false, message: "Failed to fetch car" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
