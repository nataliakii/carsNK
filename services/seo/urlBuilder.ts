import { absoluteUrl, getBaseUrl } from "@config/domain";

export function getCanonicalBaseUrl(): string {
  return getBaseUrl();
}

export function toAbsoluteUrl(pathname: string): string {
  return absoluteUrl(pathname);
}
