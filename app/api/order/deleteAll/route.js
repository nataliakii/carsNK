import { Order } from "@models/order";
import { Car } from "@models/car";
import { PriceBreakdown } from "@models/PriceBreakdown";
import { connectToDB } from "@lib/database";
import {
  publicIdsFromOrderDrivingLicenceUrls,
  deleteCloudinaryImagesByPublicIds,
} from "@/domain/orders/deleteOrderCloudinaryAssets";

export const DELETE = async (request) => {
  try {
    await connectToDB();

    const ordersForAssets = await Order.find({})
      .select("drivingLicenceUrls")
      .lean();
    const allPublicIds = new Set();
    for (const o of ordersForAssets) {
      for (const id of publicIdsFromOrderDrivingLicenceUrls(o)) {
        allPublicIds.add(id);
      }
    }
    try {
      await deleteCloudinaryImagesByPublicIds([...allPublicIds]);
    } catch (cloudErr) {
      console.error(
        "[order deleteAll] Cloudinary asset cleanup failed:",
        cloudErr?.message || cloudErr
      );
    }

    await PriceBreakdown.deleteMany({});
    await Order.deleteMany({});

    // Update all cars to clear their orders array
    await Car.updateMany({}, { $set: { orders: [] } });

    return new Response("ALl orders deleted", {
      status: 200,
    });
  } catch (error) {
    console.error("Error deleting orders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
