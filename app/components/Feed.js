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

import Navbar from "@app/components/Navbar";

// Lazy load Footer (below fold, can load after initial render)
const Footer = dynamic(() => import("@app/components/Footer"), {
  ssr: true, // Safe for SEO - footer content should be indexed
});

function Feed({ children, ...props }) {
  // unstable_noStore() не нужен в клиентском компоненте

  const shouldShowFooter = !props.isAdmin; // Скрываем Footer, если isAdmin === true

  // Quick fix: reduce main top padding for admin pages so content sits directly
  // under the fixed AppBar / admin topbar. Use a safe default (64px).
  // Мемоизируем mainPt, чтобы не пересоздавать объект при каждом рендере
  const mainPt = useMemo(
    () =>
      props.isAdmin
        ? { xs: "0px", md: "0px" }
        : { xs: "110px", md: "90px" },
    [props.isAdmin]
  );

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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carsLength, firstCarId, ordersLength, firstOrderId, companyId]
  );

  return (
    <Suspense fallback={<Loading />}>
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i}>
          <MainContextProvider
            carsData={contextProps.carsData}
            ordersData={contextProps.ordersData}
            companyData={contextProps.companyData}
          >
            <Navbar isMain={props.isMain} isAdmin={props.isAdmin} />
            {/* main paddingTop keeps content below fixed Navbar + filters; responsive values */}
            <Box component="main" sx={{ pt: mainPt }}>
              {children}
            </Box>
            {shouldShowFooter && <Footer />}
            <ScrollButton />
          </MainContextProvider>
        </I18nextProvider>
      </ThemeProvider>
    </Suspense>
  );
}

export default Feed;
