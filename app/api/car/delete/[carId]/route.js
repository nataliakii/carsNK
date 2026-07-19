import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@lib/adminAuth";
import { canAccessOwnedDoc } from "@/domain/owners/ownerScope";

export const DELETE = async (request, { params }) => {
  try {
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    await connectToDB();
    const { carId } = params;

    const existingCar = await Car.findById(carId).lean();
    if (!existingCar) {
      return new Response(JSON.stringify({ message: "Car not found" }), {
        status: 404,
      });
    }
    if (!canAccessOwnedDoc(session.user, existingCar)) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
      });
    }

    await Car.findByIdAndDelete(carId);

    // Инвалидируем кеш для списка машин
    revalidateTag("cars");
    revalidatePath("/api/car/all");
    revalidatePath("/api/car/models");
    revalidatePath(`/api/car/${carId}`);

    return new Response(
      JSON.stringify({ message: `Car with id ${carId} deleted successfully` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error deleting car:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
