"use client";
import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Preloader from "./Preloader";

export default function RouteTransitionLoader({ children }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  // первая загрузка — дольше
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setFirstLoad(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // при каждом переходе — короткий лоадер
  useLayoutEffect(() => {
    if (!firstLoad) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 1000);
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
