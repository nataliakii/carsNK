/**
 * @jest-environment node
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import { ROUTABLE_LOCALES } from "@domain/locationSeo/locationSeoKeys";
import {
  ORDER_PAY_CANCEL_PATH,
  ORDER_PAY_SUCCESS_PATH,
  resolveOrderPayReturnPath,
} from "../orderPayReturnRoute";

const PAGE_FILES = {
  [ORDER_PAY_SUCCESS_PATH]: "app/order/pay/success/page.js",
  [ORDER_PAY_CANCEL_PATH]: "app/order/pay/cancel/page.js",
};

function pageFileExists(routePath) {
  const relative = PAGE_FILES[routePath];
  return fs.existsSync(path.join(process.cwd(), relative));
}

function requestFor(pathname, headers = {}) {
  return new NextRequest(new URL(pathname, "http://localhost:3026"), { headers });
}

function rewriteUrl(response) {
  const header = response.headers.get("x-middleware-rewrite");
  return header ? new URL(header) : null;
}

describe("Stripe order pay return routes", () => {
  it("builds success and cancel URLs on pages that exist, with session_id kept", () => {
    const checkout = fs.readFileSync(
      path.join(process.cwd(), "domain/orders/rentalStripeCheckout.js"),
      "utf8"
    );
    expect(checkout).toContain(
      "success_url: `${baseUrl}/order/pay/success?session_id={CHECKOUT_SESSION_ID}`"
    );
    expect(checkout).toContain(
      "cancel_url: `${baseUrl}/order/pay/cancel?order=${String(doc._id)}`"
    );
    expect(checkout).not.toMatch(/\/\$\{[^}]*locale[^}]*\}\/order\/pay\//);

    expect(resolveOrderPayReturnPath(ORDER_PAY_SUCCESS_PATH)).toBe(ORDER_PAY_SUCCESS_PATH);
    expect(resolveOrderPayReturnPath(ORDER_PAY_CANCEL_PATH)).toBe(ORDER_PAY_CANCEL_PATH);
    expect(pageFileExists(ORDER_PAY_SUCCESS_PATH)).toBe(true);
    expect(pageFileExists(ORDER_PAY_CANCEL_PATH)).toBe(true);
  });

  it.each(ROUTABLE_LOCALES)(
    "resolves /%s/order/pay/success and cancel to the existing locale-free pages",
    (locale) => {
      const success = resolveOrderPayReturnPath(`/${locale}/order/pay/success`);
      const cancel = resolveOrderPayReturnPath(`/${locale}/order/pay/cancel`);
      expect(success).toBe(ORDER_PAY_SUCCESS_PATH);
      expect(cancel).toBe(ORDER_PAY_CANCEL_PATH);
      expect(pageFileExists(success)).toBe(true);
      expect(pageFileExists(cancel)).toBe(true);
    }
  );

  it("does not 404 a Catalan prefix or an unknown prefix", () => {
    expect(resolveOrderPayReturnPath("/ca/order/pay/success")).toBe(ORDER_PAY_SUCCESS_PATH);
    expect(resolveOrderPayReturnPath("/ca/order/pay/cancel")).toBe(ORDER_PAY_CANCEL_PATH);
    expect(resolveOrderPayReturnPath("/zz/order/pay/success")).toBe(ORDER_PAY_SUCCESS_PATH);
    expect(resolveOrderPayReturnPath("/zz/order/pay/cancel")).toBe(ORDER_PAY_CANCEL_PATH);
    expect(pageFileExists(ORDER_PAY_SUCCESS_PATH)).toBe(true);
    expect(pageFileExists(ORDER_PAY_CANCEL_PATH)).toBe(true);
  });

  it("serves the Stripe success URL in place when the browser language is Catalan", () => {
    const response = middleware(
      requestFor("/order/pay/success?session_id=cs_test_a10", {
        "accept-language": "ca-ES,ca;q=0.9,en;q=0.8",
      })
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rewrites /ca/order/pay/success onto the existing page and keeps session_id", () => {
    const response = middleware(
      requestFor("/ca/order/pay/success?session_id=cs_test_a10RgqJ2Nh6y")
    );
    const rewritten = rewriteUrl(response);

    expect(response.status).not.toBe(301);
    expect(response.headers.get("location")).toBeNull();
    expect(rewritten?.pathname).toBe(ORDER_PAY_SUCCESS_PATH);
    expect(rewritten?.searchParams.get("session_id")).toBe("cs_test_a10RgqJ2Nh6y");
    expect(pageFileExists(ORDER_PAY_SUCCESS_PATH)).toBe(true);
  });

  it("rewrites a locale-prefixed cancel URL onto the existing cancel page", () => {
    const response = middleware(
      requestFor("/ca/order/pay/cancel?order=507f1f77bcf86cd799439011", {
        "accept-language": "ca",
      })
    );
    const rewritten = rewriteUrl(response);

    expect(rewritten?.pathname).toBe(ORDER_PAY_CANCEL_PATH);
    expect(rewritten?.searchParams.get("order")).toBe("507f1f77bcf86cd799439011");
    expect(pageFileExists(ORDER_PAY_CANCEL_PATH)).toBe(true);
  });

  it("still prefixes ordinary pages with the detected locale", () => {
    const response = middleware(
      requestFor("/for-business", { "accept-language": "ca" })
    );
    expect(response.status).toBe(301);
    expect(new URL(response.headers.get("location")).pathname).toBe("/ca/for-business");
  });
});
