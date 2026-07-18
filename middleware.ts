import { NextRequest, NextResponse } from "next/server";
import {
  buildCanonicalRedirectUrl,
  shouldRedirectToCanonicalHost,
} from "@/services/seo/domainRedirect";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER_NAME,
  LOCATION_IDS,
  type LocationId,
} from "@domain/locationSeo/locationSeoKeys";
import {
  detectBestLocale,
  getAllLocationsForLocale,
  getLocationById,
  getLocationPath,
  getLocationPathFromLocation,
  getPathWithoutLocalePrefix,
  getStaticPagePath,
  isLocalePrefixedPath,
  isSupportedLocale,
  normalizeLocale,
  withLocalePrefix,
} from "@domain/locationSeo/locationSeoService";
import { WEBSITE_VISIT_SESSION_COOKIE } from "@domain/visitors/websiteVisitNotification";

const PUBLIC_FILE_REGEX = /\.[^/]+$/;
const EXCLUDED_PREFIXES = ["/api", "/admin", "/_next"];
const EXCLUDED_PATHS = new Set([
  "/favicon.ico",
  "/favicon.png",
  "/icon.png",
  "/apple-icon.png",
  "/robots.txt",
  "/sitemap.xml",
  "/login",
  "/yandex_47737f1ecab05a33.html",
]);

const legacyLocationByCanonicalSlug = new Map<string, LocationId>(
  getAllLocationsForLocale("en").map((location) => [location.canonicalSlug, location.id])
);

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutTrailing = withLeading.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

function shouldSkip(pathname: string): boolean {
  if (PUBLIC_FILE_REGEX.test(pathname)) return true;
  if (EXCLUDED_PATHS.has(pathname)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function withSearchParams(pathname: string, request: NextRequest): string {
  const search = request.nextUrl.search || "";
  return `${pathname}${search}`;
}

function buildLegacyLocationRedirect(
  locale: string,
  pathWithoutLocale: string
): string | null {
  const cleanPath = pathWithoutLocale.replace(/^\//, "");
  if (!cleanPath) return null;

  // /locations/{canonical-slug} → /{locale}/locations/{locale-slug}
  // Only redirect when the slug differs (canonical → locale-specific)
  const locationsMatch = cleanPath.match(/^locations\/(.+)$/);
  if (locationsMatch) {
    const slug = locationsMatch[1];
    const locationId = legacyLocationByCanonicalSlug.get(slug);
    if (locationId) {
      const location = getLocationById(locale, locationId);
      if (location) {
        const canonicalPath = getLocationPathFromLocation(locale, location);
        const currentPath = `/${locale}/locations/${slug}`;
        if (canonicalPath !== currentPath) {
          return canonicalPath;
        }
      }
    }

    // Legacy id-based URLs like /locations/thessaloniki or /locations/halkidiki
    // should also redirect to the new localized SEO slug paths.
    const legacyId = Object.values(LOCATION_IDS).find((id) => id === slug);
    if (legacyId) {
      const loc = getLocationById(locale, legacyId);
      if (loc) {
        const target = getLocationPathFromLocation(locale, loc);
        // Avoid redirecting when the URL is already canonical.
        const current = getLocationPath(locale, slug);
        if (target !== current) {
          return target;
        }
      }
    }

    return null;
  }

  // /car-rental-xxx (flat canonical slug without /locations/ prefix)
  if (cleanPath.includes("/")) return null;

  const locationId = legacyLocationByCanonicalSlug.get(cleanPath);
  if (!locationId) return null;

  const location = getLocationById(locale, locationId);
  if (!location) return null;

  return getLocationPathFromLocation(locale, location);
}

function withLocaleCookie(response: NextResponse, locale: string): NextResponse {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

function nextWithLocaleHeader(request: NextRequest, locale: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_REQUEST_HEADER_NAME, locale);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function withVisitSessionCookie(response: NextResponse, sessionId: string): NextResponse {
  response.cookies.set(WEBSITE_VISIT_SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export function middleware(request: NextRequest) {
  const normalizedPathname = normalizePathname(request.nextUrl.pathname);
  if (
    shouldRedirectToCanonicalHost({
      hostname: request.nextUrl.hostname,
      pathname: normalizedPathname,
    })
  ) {
    return NextResponse.redirect(buildCanonicalRedirectUrl(request.url), 308);
  }

  const existingSessionId = request.cookies.get(WEBSITE_VISIT_SESSION_COOKIE)?.value?.trim();
  const visitSessionId = existingSessionId || crypto.randomUUID();

  if (shouldSkip(normalizedPathname)) {
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value || null;
  const headerLocale = request.headers.get("accept-language");
  const detectedLocale = detectBestLocale({
    cookieLocale,
    acceptLanguageHeader: headerLocale,
  });

  // Root URL -> localized Thessaloniki Airport location page.
  if (!isLocalePrefixedPath(normalizedPathname) && normalizedPathname === "/") {
    const airportLocation = getLocationById(
      detectedLocale,
      LOCATION_IDS.THESSALONIKI_AIRPORT
    );
    const airportPath = airportLocation
      ? getLocationPathFromLocation(detectedLocale, airportLocation)
      : withLocalePrefix(detectedLocale, normalizedPathname);
    const target = withSearchParams(airportPath, request);
    const url = new URL(target, request.url);
    return withVisitSessionCookie(
      withLocaleCookie(NextResponse.redirect(url, 301), detectedLocale),
      visitSessionId
    );
  }

  // Old non-prefixed location URLs -> locale-prefixed /{locale}/locations/{slug}
  const legacyLocationRedirect = buildLegacyLocationRedirect(
    detectedLocale,
    normalizedPathname
  );
  if (!isLocalePrefixedPath(normalizedPathname) && legacyLocationRedirect) {
    const target = withSearchParams(legacyLocationRedirect, request);
    const url = new URL(target, request.url);
    return withVisitSessionCookie(
      withLocaleCookie(NextResponse.redirect(url, 301), detectedLocale),
      visitSessionId
    );
  }

  // /terms -> /{locale}/rental-terms
  if (!isLocalePrefixedPath(normalizedPathname) && normalizedPathname === "/terms") {
    const target = withSearchParams(getStaticPagePath(detectedLocale, "rental-terms"), request);
    const url = new URL(target, request.url);
    return withVisitSessionCookie(
      withLocaleCookie(NextResponse.redirect(url, 301), detectedLocale),
      visitSessionId
    );
  }

  // Locale-prefixed request: enforce normalized path + locale cookie.
  if (isLocalePrefixedPath(normalizedPathname)) {
    const firstSegment = normalizedPathname.split("/").filter(Boolean)[0];
    const locale = normalizeLocale(firstSegment || null);

    // /{locale}/car-rental-... -> /{locale}/locations/{slug}
    const stripped = getPathWithoutLocalePrefix(normalizedPathname);
    const localizedLegacyLocationRedirect = buildLegacyLocationRedirect(locale, stripped);
    if (localizedLegacyLocationRedirect) {
      const target = withSearchParams(localizedLegacyLocationRedirect, request);
      const url = new URL(target, request.url);
      return withVisitSessionCookie(
        withLocaleCookie(NextResponse.redirect(url, 301), locale),
        visitSessionId
      );
    }

    // /{locale}/home -> /{locale}
    if (stripped === "/home") {
      const target = withSearchParams(`/${locale}`, request);
      const url = new URL(target, request.url);
      return withVisitSessionCookie(
        withLocaleCookie(NextResponse.redirect(url, 301), locale),
        visitSessionId
      );
    }

    // /{locale}/terms -> /{locale}/rental-terms
    if (stripped === "/terms") {
      const target = withSearchParams(getStaticPagePath(locale, "rental-terms"), request);
      const url = new URL(target, request.url);
      return withVisitSessionCookie(
        withLocaleCookie(NextResponse.redirect(url, 301), locale),
        visitSessionId
      );
    }

    // Normalize unsupported /{xx}/... locale prefixes to detected locale.
    if (!isSupportedLocale(firstSegment || null)) {
      const nextPath = withLocalePrefix(detectedLocale, stripped);
      const target = withSearchParams(nextPath, request);
      const url = new URL(target, request.url);
      return withVisitSessionCookie(
        withLocaleCookie(NextResponse.redirect(url, 301), detectedLocale),
        visitSessionId
      );
    }

    if (request.cookies.get(LOCALE_COOKIE_NAME)?.value !== locale) {
      const response = withVisitSessionCookie(
        withLocaleCookie(nextWithLocaleHeader(request, locale), locale),
        visitSessionId
      );
      return response;
    }

    const response = withVisitSessionCookie(nextWithLocaleHeader(request, locale), visitSessionId);
    return response;
  }

  // Non-prefixed request -> locale-prefixed canonical URL.
  const localizedPath = withLocalePrefix(detectedLocale, normalizedPathname);
  const target = withSearchParams(localizedPath, request);
  const url = new URL(target, request.url);

  return withVisitSessionCookie(
    withLocaleCookie(NextResponse.redirect(url, 301), detectedLocale),
    visitSessionId
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)"],
};
