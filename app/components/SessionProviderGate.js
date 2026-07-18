"use client";

import { SessionProvider } from "next-auth/react";

/**
 * App-wide next-auth context. Must wrap any tree that uses useSession() (Navbar, admin).
 * Deferred mount was removed: without SessionProvider on the server/first paint, useSession() throws.
 */
export default function SessionProviderGate({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
