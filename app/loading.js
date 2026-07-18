//"use client";

// import { useEffect, useState } from "react";
// import { usePathname } from "next/navigation";
// import Image from "next/image";
import Preloader from "./components/Loader/Preloader";

export default function Loading() {
  return <Preloader loading={true} />;
}
