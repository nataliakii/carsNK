"use client";

import { MainContextProvider } from "./Context";
import { SnackbarProvider } from "notistack";
import { I18nextProvider } from "react-i18next";
import SessionProviderGate from "@app/components/SessionProviderGate";
import i18n from "../locales/i18n";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "../theme";
import { CookieConsentProvider } from "@app/components/CookieBanner";
import { CookieBanner } from "@app/components/CookieBanner";
import { Analytics } from "@app/components/Analytics";
import WebsiteVisitTracker from "@app/components/WebsiteVisitTracker";

export default function Providers({ children }) {
  return (
    <SessionProviderGate>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <CookieConsentProvider>
            <SnackbarProvider
              maxSnack={3}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              autoHideDuration={3000}
            >
              <MainContextProvider>{children}</MainContextProvider>
            </SnackbarProvider>
            {/* Cookie Banner - shown until user makes a choice */}
            <CookieBanner />
            {/* Human visit notifications are sent client-side after real engagement. */}
            <WebsiteVisitTracker />
            {/* Analytics - only loads after consent is accepted */}
            <Analytics />
          </CookieConsentProvider>
        </ThemeProvider>
      </I18nextProvider>
    </SessionProviderGate>
  );
}
