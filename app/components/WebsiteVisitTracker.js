"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_STORAGE_KEY = "nc_human_visit_sent";
const MIN_VISIBLE_DELAY_MS = 12000;
const MIN_SCROLL_Y_PX = 120;

function isTrackablePath(pathname) {
  const normalized = typeof pathname === "string" ? pathname.trim() : "";
  if (!normalized) return false;
  if (normalized.startsWith("/admin")) return false;
  if (normalized.startsWith("/api")) return false;
  if (normalized === "/login") return false;
  return true;
}

function getSessionStorageFlag(key) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setSessionStorageFlag(key) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage failures; server-side dedupe remains the final guard.
  }
}

export default function WebsiteVisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname || ""}?${searchParams?.toString() || ""}`;
  const sentRef = useRef(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!isTrackablePath(pathname)) return undefined;
    if (navigator.webdriver) return undefined;

    sentRef.current = getSessionStorageFlag(SESSION_STORAGE_KEY);
    if (sentRef.current) {
      return undefined;
    }

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const sendVisit = async (proof) => {
      if (sentRef.current || inFlightRef.current) return;

      inFlightRef.current = true;

      try {
        const response = await fetch("/api/internal/website-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-website-visit-client": "browser",
          },
          credentials: "same-origin",
          keepalive: true,
          body: JSON.stringify({
            url: window.location.href,
            language: navigator.language || "",
            proof,
          }),
        });

        if (response.ok) {
          sentRef.current = true;
          setSessionStorageFlag(SESSION_STORAGE_KEY);
          clearTimer();
          return;
        }

        // Auth/config rejections will not succeed on retry — stop spamming the console.
        if (response.status === 401 || response.status === 403) {
          sentRef.current = true;
          clearTimer();
        }
      } catch {
        // Ignore transient client/network errors; a later interaction can retry.
      } finally {
        if (!sentRef.current) {
          inFlightRef.current = false;
        }
      }
    };

    const armVisibleTimer = () => {
      clearTimer();

      if (document.visibilityState !== "visible" || sentRef.current) {
        return;
      }

      timerRef.current = window.setTimeout(() => {
        void sendVisit("visible_delay");
      }, MIN_VISIBLE_DELAY_MS);
    };

    const handlePointerDown = () => {
      void sendVisit("pointerdown");
    };

    const handleKeyDown = () => {
      void sendVisit("keydown");
    };

    const handleWheel = () => {
      void sendVisit("wheel");
    };

    const handleTouchStart = () => {
      void sendVisit("touchstart");
    };

    const handleScroll = () => {
      if ((window.scrollY || 0) >= MIN_SCROLL_Y_PX) {
        void sendVisit("scroll");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        armVisibleTimer();
        return;
      }

      clearTimer();
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    armVisibleTimer();

    return () => {
      clearTimer();
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, routeKey]);

  return null;
}
