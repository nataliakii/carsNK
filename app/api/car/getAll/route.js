/**
 * Compatibility alias for /api/car/getAll.
 *
 * Historical / mistaken callers hit the catch-all [...id] route with id="getAll",
 * which called Car.findById("getAll") → CastError → HTTP 500 "Failed to fetch car".
 * This route shares the same handlers as /api/car/all.
 */
import {
  carListDynamic,
  carListRevalidate,
  listCarsGet,
  listCarsPost,
} from "../_listCars";

export const dynamic = carListDynamic;
export const revalidate = carListRevalidate;

export const GET = listCarsGet;
export const POST = listCarsPost;
