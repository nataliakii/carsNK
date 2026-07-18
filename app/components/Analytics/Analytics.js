"use client";

/**
 * Google tag (gtag.js): Analytics (G-*) and/or Google Ads (AW-*).
 *
 * GDPR: loads only after cookie consent === "accepted".
 * Single gtag.js request + one init block (multiple gtag('config', …) as Google documents).
 *
 * ⚠️ Must stay inside CookieConsentProvider (see app/providers.js).
 *
 * Purchase conversions: domain/analytics/googleAdsConversion.js
 * (send_to override: NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO).
 */

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useCookieConsent } from "@app/components/CookieBanner";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
/** Google Ads / conversion tag (public ID; override via env if needed). */
const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-18041368857";

export default function Analytics() {
  const { isAccepted, isLoaded } = useCookieConsent();
  const isInitialized = useRef(false);

  // Track consent state for analytics events
  useEffect(() => {
    // Only run if consent is loaded and accepted
    if (!isLoaded || !isAccepted) {
      return;
    }

    // Prevent duplicate initialization
    if (isInitialized.current) {
      return;
    }

    if (!GA_MEASUREMENT_ID && !GOOGLE_ADS_ID) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Analytics] No GA or Google Ads ID configured, skipping");
      }
      return;
    }

    isInitialized.current = true;

    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics] Consent accepted, initializing analytics");
    }
  }, [isLoaded, isAccepted]);

  const primaryGtagSrcId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;

  // Don't render anything if:
  // - Consent is not yet loaded (still checking localStorage)
  // - User has not accepted cookies
  // - No GA / Ads ID is configured
  if (!isLoaded || !isAccepted || !primaryGtagSrcId) {
    return null;
  }

  const initSnippet = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            ${
              GA_MEASUREMENT_ID
                ? `gtag('config', ${JSON.stringify(GA_MEASUREMENT_ID)}, {
              page_path: window.location.pathname,
              anonymize_ip: true,
            });`
                : ""
            }
            ${
              GOOGLE_ADS_ID
                ? `gtag('config', ${JSON.stringify(GOOGLE_ADS_ID)});`
                : ""
            }
          `;

  return (
    <>
      {/* One gtag.js load + configs for GA and/or Google Ads — only after consent */}
      <Script
        id="google-gtag-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagSrcId}`}
      />
      <Script
        id="google-gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initSnippet }}
      />
    </>
  );
}
