import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import { toBusinessDateTime } from "@/domain/orders/numberOfDays";
import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import { toBooleanField } from "@/domain/orders/fieldUtils";

export async function POST(request) {
  // Логируем параметры для диагностики
  let debugBody;
  try {
    await connectToDB();
    debugBody = await request.json();
    const {
      carId,
      carNumber,
      regNumber,
      rentalStartDate,
      rentalEndDate,
      timeIn,
      timeOut,
      kacko = "TPL",
      childSeats = 0,
      secondDriver = false,
      placeIn,
      placeOut,
    } = debugBody;
    const calculationStartSource = timeIn ?? rentalStartDate;
    const calculationEndSource = timeOut ?? rentalEndDate;
    const normalizedStartDate = toBusinessDateTime(calculationStartSource);
    const normalizedEndDate = toBusinessDateTime(calculationEndSource);
    const normalizedSecondDriver = toBooleanField(secondDriver, false);
    console.log("[API calcTotalPrice] Получены параметры:", {
      carId,
      carNumber,
      regNumber,
      rentalStartDate,
      rentalEndDate,
      timeIn,
      timeOut,
      normalizedStartDate,
      normalizedEndDate,
      kacko,
      childSeats,
      secondDriver: normalizedSecondDriver,
    });
    const normalizedCarId = carId != null ? String(carId).trim() : "";
    const normalizedCarNumber =
      typeof carNumber === "string" ? carNumber.trim() : "";
    const normalizedRegNumber =
      typeof regNumber === "string" ? regNumber.trim() : "";
    if (
      (!normalizedCarId && !normalizedRegNumber && !normalizedCarNumber) ||
      !normalizedStartDate ||
      !normalizedEndDate ||
      !normalizedStartDate.isValid() ||
      !normalizedEndDate.isValid()
    ) {
      return new Response(JSON.stringify({ message: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // _id is always unique (MongoDB default index). Fallback: carNumber, then regNumber.
    let car = null;
    if (normalizedCarId && mongoose.Types.ObjectId.isValid(normalizedCarId)) {
      car = await Car.findById(normalizedCarId);
    }
    if (!car && normalizedCarNumber) {
      car = await Car.findOne({ carNumber: normalizedCarNumber });
    }
    if (!car && normalizedRegNumber) {
      car = await Car.findOne({ regNumber: normalizedRegNumber });
    }

    if (!car) {
      return new Response(JSON.stringify({ message: "Car not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("API calcTotalPrice params:", {
      kacko,
      childSeats,
      secondDriver: normalizedSecondDriver,
    });
    const { total, days, breakdown } = await car.calculateTotalRentalPricePerDay(
      normalizedStartDate,
      normalizedEndDate,
      kacko,
      childSeats,
      normalizedSecondDriver
    );

    let deliveryData = {};
    if (placeIn || placeOut) {
      try {
        deliveryData = await calculateDeliveryPrice({ placeIn, placeOut });
      } catch (err) {
        console.error("[calcTotalPrice] Delivery calc error:", err);
      }
    }

    return new Response(
      JSON.stringify({
        totalPrice: total,
        days,
        breakdown: { ...breakdown, ...deliveryData },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
