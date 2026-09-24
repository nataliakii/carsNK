"use client";
import React, { useState, useEffect, Suspense, useMemo } from "react";
import { ThemeProvider } from "@mui/material";
import darkTheme from "@theme";
import { I18nextProvider } from "react-i18next";
import { unstable_noStore } from "next/cache";

import Loading from "@app/loading";
import { Box } from "@mui/material";

import i from "@locales/i18n";
import { MainContextProvider } from "../Context";

import dynamic from "next/dynamic";
import ScrollButton from "@/app/components/ui/buttons/ScrollButton";

import Navbar, { CATALOG_CHROME_OFFSET_VAR } from "@app/components/Navbar";
import { usePathname } from "next/navigation";

// Lazy load Footer (below fold, can load after initial render)
const Footer = dynamic(() => import("@app/components/Footer"), {
  ssr: true, // Safe for SEO - footer content should be indexed
});

function Feed({ children, ...props }) {
  const pathname = usePathname();
  const isAccessLink =
    typeof pathname === "string" && pathname.startsWith("/access/");

  const shouldShowFooter = !props.isAdmin && !isAccessLink;

  // Admin AppBar is fixed at 64px — clear it so page titles are not hidden.
  // Catalog (isMain) uses a CSS var measured by Navbar for the fixed header +
  // filter bar, plus a small gap so results/meta text is not under the black bar.
  const mainPt = useMemo(() => {
    if (props.isAdmin || isAccessLink) {
      return { xs: "64px", md: "64px" };
    }
    if (props.isMain) {
      // Fallback covers a wrapped multi-row filter until ResizeObserver runs.
      return `var(${CATALOG_CHROME_OFFSET_VAR}, 280px)`;
    }
    return { xs: "64px", md: "64px" };
  }, [props.isAdmin, props.isMain, isAccessLink]);

  // Admin calendar passes fillsViewport; accept fillViewport typo too.
  const fillViewport = Boolean(props.fillsViewport || props.fillViewport);

  // If a previous calendar visit left inline overflow:hidden on html/body,
  // restore document scroll on any normal (non-calendar) Feed mount.
  useEffect(() => {
    if (fillViewport) return;
    const html = document.documentElement;
    const body = document.body;
    if (html.style.overflow === "hidden") html.style.overflow = "";
    if (body.style.overflow === "hidden") body.style.overflow = "";
    if (html.style.height === "100%") html.style.height = "";
    if (body.style.height === "100%") body.style.height = "";
  }, [fillViewport]);

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Keep i18n language and locale cookie aligned with URL locale prefix.
  useEffect(() => {
    const locale = typeof props.locale === "string" ? props.locale.toLowerCase() : null;
    if (!locale) return;

    const supported = Array.isArray(i?.options?.supportedLngs)
      ? i.options.supportedLngs
      : [];

    if (supported.includes(locale)) {
      i.changeLanguage(locale).catch(() => {});
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("selectedLanguage", locale);
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    }
  }, [props.locale]);

  // Admin routes have no /en/ prefix — re-apply saved UI language on mount.
  useEffect(() => {
    if (!props.isAdmin || typeof window === "undefined") return;
    const saved = localStorage.getItem("selectedLanguage");
    const supported = Array.isArray(i?.options?.supportedLngs)
      ? i.options.supportedLngs
      : [];
    if (saved && supported.includes(saved) && i.language !== saved) {
      i.changeLanguage(saved).catch(() => {});
    }
  }, [props.isAdmin]);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setIsDarkMode(false);
    }
  }, []);

  // Мемоизируем пропсы для Context, чтобы предотвратить ненужные ре-рендеры
  const carsLength = props.cars?.length;
  const firstCarId = props.cars?.[0]?._id;
  const ordersLength = props.orders?.length;
  const firstOrderId = props.orders?.[0]?._id;
  const companyId = props.company?._id;
  
  const contextProps = useMemo(
    () => ({
      carsData: props.cars,
      ordersData: props.orders,
      companyData: props.company,
      initialPickup: props.initialPickup || "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carsLength, firstCarId, ordersLength, firstOrderId, companyId, props.initialPickup]
  );

  return (
    <Suspense fallback={<Loading />}>
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i}>
          <MainContextProvider
            carsData={contextProps.carsData}
            ordersData={contextProps.ordersData}
            companyData={contextProps.companyData}
            initialPickup={contextProps.initialPickup}
          >
            <Box className={props.isAdmin ? "admin-shell" : undefined} sx={{ width: "100%" }}>
            <Navbar isMain={props.isMain} isAdmin={props.isAdmin} />
            {/* main paddingTop keeps content below fixed Navbar + filters; responsive values */}
            <Box
              component="main"
              sx={{
                pt: mainPt,
                width: "100%",
                boxSizing: "border-box",
                ...(fillViewport
                  ? {
                      height: "100dvh",
                      maxHeight: "100dvh",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxSizing: "border-box",
                      minHeight: 0,
                    }
                  : null),
              }}
            >
              {fillViewport ? (
                <Box
                  sx={{
                    flex: "1 1 0%",
                    height: 0,
                    minHeight: 0,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  {children}
                </Box>
              ) : (
                children
              )}
            </Box>
            {shouldShowFooter && <Footer />}
            {!fillViewport && <ScrollButton />}
            </Box>
          </MainContextProvider>
        </I18nextProvider>
      </ThemeProvider>
    </Suspense>
  );
}

export default Feed;
