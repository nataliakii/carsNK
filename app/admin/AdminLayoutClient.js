"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { loginUrlForReturn } from "@/domain/admin/adminReturnTo";
import Loading from "../loading";
import AccessLinkSessionBanner from "./shared/components/AccessLinkSessionBanner";
import "@styles/globals.css";
import "antd/dist/reset.css";

function AdminContent({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.invalidAccessLink) {
      if (session?.user?.invalidAccessLink) {
        signOut({ callbackUrl: "/login" });
        return;
      }
      if (!session) {
        router.replace("/login");
      } else if (!session.user?.isAdmin) {
        router.replace("/");
      }
      return;
    }
    if (!session.user?.isAdmin) {
      router.replace("/");
    }
  }, [session, status, router]);

  // показываем лоадер пока идёт загрузка или редирект
  if (status === "loading" || !session || !session.user?.isAdmin) {
    return <Loading />;
  }

  return (
    <>
      <AccessLinkSessionBanner />
      {children}
    </>
  );
}

export default function AdminLayoutClient({ children }) {
  return (
    <SessionProvider>
      <AdminContent>{children}</AdminContent>
    </SessionProvider>
  );
}
