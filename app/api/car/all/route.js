import {
  carListDynamic,
  carListRevalidate,
  listCarsGet,
  listCarsPost,
} from "../_listCars";

// Session-dependent listing — never publicly cache (admins must see inactive cars).
export const dynamic = carListDynamic;
export const revalidate = carListRevalidate;

export const GET = listCarsGet;
export const POST = listCarsPost;
