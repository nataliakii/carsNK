import "@styles/globals.css";
import "antd/dist/reset.css";
import Providers from "./providers";
import LoaderWrapper from "./components/Loader/LoaderWrapper";
import Script from "next/script";
import { headers } from "next/headers";
import { getSeoConfig } from "@config/seo";
import { getPrimaryKeywords } from "@config/seoKeywords";
import {
  getDefaultLocale,
  normalizeLocale,
  getSupportedLocales,
} from "@domain/locationSeo/locationSeoService";
import { LOCALE_REQUEST_HEADER_NAME } from "@domain/locationSeo/locationSeoKeys";

// Use fallback data for global layout metadata (layout loads before pages)
const seoConfig = getSeoConfig();
const supportedLocales = getSupportedLocales();
const defaultLocale = getDefaultLocale();

// SEO: Multilingual keywords for better indexing in target markets
// EN (international), RU (CIS tourists), DE (DACH region), SR (Balkans), EL (local)
const multilangKeywords = getPrimaryKeywords(8);
// Do NOT set alternates.canonical or alternates.languages here. Each [locale] page
// must set its own canonical (self-referencing) and hreflang via generateMetadata.
// Otherwise non-default locales would inherit canonical to defaultLocale → "Google chose different canonical".
const GA_MEASUREMENT_ID = "G-FY6325TNLP";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: seoConfig.siteName,
  url: seoConfig.baseUrl,
  logo: `${seoConfig.baseUrl}/favicon.png`,
  sameAs: [
    seoConfig.social.facebook,
    seoConfig.social.instagram,
    seoConfig.social.linkedin,
  ].filter(Boolean),
  contactPoint: {
    "@type": "ContactPoint",
    telephone: seoConfig.contact.phone,
    contactType: "customer support",
    email: seoConfig.contact.email,
    areaServed: "GR",
    availableLanguage: supportedLocales,
  },
};

export const metadata = {
  metadataBase: new URL(seoConfig.baseUrl),
  title: {
    default: seoConfig.defaultTitle,
    template: seoConfig.titleTemplate,
  },
  description: seoConfig.defaultDescription,
  keywords: multilangKeywords,
  authors: [{ name: seoConfig.siteName }],
  creator: seoConfig.siteName,
  publisher: seoConfig.siteName,
  openGraph: {
    type: "website",
    locale: seoConfig.defaultLocale,
    url: seoConfig.baseUrl,
    siteName: seoConfig.siteName,
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [
      {
        url: `${seoConfig.baseUrl}/favicon.png`,
        width: 1200,
        height: 630,
        alt: seoConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [`${seoConfig.baseUrl}/favicon.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google637fd0fc04836d73.html",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
};

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get(LOCALE_REQUEST_HEADER_NAME) || defaultLocale);

  return (
    <html lang={locale} translate="no">
      <head>
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-tag-gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="prefers-color-scheme" content="light" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-navbutton-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* <meta name="color-scheme" content="light" /> */}
        <meta name="color-scheme" content="only light" />
        <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <Providers>
          <LoaderWrapper>{children}</LoaderWrapper>
        </Providers>
      </body>
    </html>
  );
}
