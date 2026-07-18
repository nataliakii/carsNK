"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "../loading";
import "@styles/globals.css";
import "antd/dist/reset.css";

function AdminContent({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // выполняем редиректы только после загрузки
  useEffect(() => {
    if (status !== "loading") {
      if (!session) {
        router.replace("/login");
      } else if (!session.user?.isAdmin) {
        router.replace("/");
      }
    }
  }, [session, status, router]);

  // показываем лоадер пока идёт загрузка или редирект
  if (status === "loading" || !session || !session.user?.isAdmin) {
    return <Loading />;
  }

  return children;
}

export default function AdminLayoutClient({ children }) {
  return (
    <SessionProvider>
      <AdminContent>{children}</AdminContent>
    </SessionProvider>
  );
}
