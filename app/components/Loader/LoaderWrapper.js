"use client";
import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Preloader from "./Preloader";

const FIRST_LOAD_MS = 700;
const ROUTE_LOAD_MS = 320;

export default function RouteTransitionLoader({ children }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  // First paint — short brand gate
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setFirstLoad(false);
    }, FIRST_LOAD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Route changes — brief cover (no long milky fade)
  useLayoutEffect(() => {
    if (!firstLoad) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), ROUTE_LOAD_MS);
      return () => clearTimeout(timer);
    }
  }, [pathname, firstLoad]);

  return (
    <>
      <Preloader loading={loading} />
      {children}
    </>
  );
}
