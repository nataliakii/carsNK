/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import BookingContractsBlock from "../BookingContractsBlock";
import BookingPriceDetails from "../BookingPriceDetails";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: "en" } }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const publishedPlatform = {
  available: true,
  source: "published",
  language: "en",
  version: 4,
  checksum: "abc123",
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  content: {
    title: "Rovaro Customer Booking Terms",
    sections: [{ id: "s1", heading: "Fee", text: "Published terms body" }],
  },
};

function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("booking checkout legal and price", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("published booking terms open in a modal and snapshot that checksum", async () => {
    const onChange = jest.fn();
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("booking-agreements")) {
        return {
          json: async () => ({
            success: true,
            platform: publishedPlatform,
            company: { available: false },
          }),
        };
      }
      return { json: async () => ({ success: false }) };
    });
    const view = mount(
      <BookingContractsBlock companyId="c1" lang="en" feeAmountMinor={2640} onChange={onChange} />
    );
    await flush();
    expect(view.container.textContent).not.toContain("Rovaro standard rental terms apply.");
    expect(view.container.textContent).not.toContain("We use your details");
    expect(view.container.textContent).not.toContain("See when the Booking Fee is refunded");
    const terms = [...view.container.querySelectorAll("button")].find((node) =>
      node.textContent.includes("Rovaro Booking Terms")
    );
    expect(terms.tagName).toBe("BUTTON");
    act(() => terms.click());
    expect(document.body.textContent).toContain("Published terms body");
    expect(document.body.textContent).toContain("Version 4");
    expect(view.container.querySelector("article")).toBeNull();
    const snapshot = onChange.mock.calls.at(-1)[0];
    expect(snapshot.payload.platform.checksum).toBe("abc123");
    expect(snapshot.payload.platform.version).toBe(4);
    expect(snapshot.companyRequired).toBe(false);
    view.unmount();
  });

  test("supplier checkbox appears only for published supplier terms", async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        success: true,
        platform: publishedPlatform,
        company: {
          available: true,
          companyName: "QA Cars",
          body: "Supplier body",
          sourceHash: "sup1",
          language: "en",
          version: 2,
        },
      }),
    }));
    const onChange = jest.fn();
    const view = mount(
      <BookingContractsBlock companyId="c1" lang="en" companyName="QA Cars" onChange={onChange} />
    );
    await flush();
    expect(view.container.textContent).toContain("I accept");
    expect(view.container.textContent).toContain("QA Cars Rental Terms");
    expect(view.container.textContent).not.toContain("Rovaro standard rental terms apply.");
    const box = view.container.querySelector('[aria-label="Accept supplier rental terms"]');
    act(() => box.click());
    expect(onChange.mock.calls.at(-1)[0].payload.company.sourceHash).toBe("sup1");
    view.unmount();
  });

  test("draft booking terms are not shown", async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        success: true,
        platform: {
          ...publishedPlatform,
          available: false,
          source: "draft",
          content: { sections: [] },
        },
        company: { available: false },
      }),
    }));
    const view = mount(<BookingContractsBlock companyId="c1" lang="en" />);
    await flush();
    expect(view.container.textContent).not.toContain("Published terms body");
    expect(view.container.textContent).toContain("platformTermsUnavailable");
    view.unmount();
  });

  test("Privacy Policy is one inline button and opens a published modal", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("privacy-policy")) {
        return {
          json: async () => ({
            success: true,
            source: "published",
            version: 3,
            language: "en",
            checksum: "priv",
            content: {
              title: "Privacy Policy",
              sections: [{ id: "p", heading: "Data", text: "Privacy body" }],
            },
          }),
        };
      }
      return {
        json: async () => ({
          success: true,
          platform: publishedPlatform,
          company: { available: false },
        }),
      };
    });
    const view = mount(<BookingContractsBlock companyId="c1" lang="en" />);
    await flush();
    const links = [...view.container.querySelectorAll("button")].filter(
      (node) => node.textContent.trim() === "Privacy Policy"
    );
    expect(links).toHaveLength(1);
    expect(links[0].tagName).toBe("BUTTON");
    expect(view.container.querySelector("h1")).toBeNull();
    expect(view.container.querySelector("a")).toBeNull();
    act(() => links[0].click());
    await flush();
    expect(document.body.textContent).toContain("Privacy body");
    expect(document.body.textContent).toContain("Version 3");
    view.unmount();
  });

  test("opening a legal modal does not clear an accepted checkbox", async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        success: true,
        platform: publishedPlatform,
        company: { available: false },
      }),
    }));
    const view = mount(<BookingContractsBlock companyId="c1" lang="en" />);
    await flush();
    const box = view.container.querySelector('[aria-label="Accept Rovaro Booking Terms"]');
    act(() => box.click());
    expect(box.checked).toBe(true);
    const terms = [...view.container.querySelectorAll("button")].find((node) =>
      node.textContent.includes("Rovaro Booking Terms")
    );
    act(() => terms.click());
    const close = document.body.querySelector('[aria-label="order.closeContract"]');
    act(() => close.click());
    expect(
      view.container.querySelector('[aria-label="Accept Rovaro Booking Terms"]').checked
    ).toBe(true);
    view.unmount();
  });

  test("collapsed price details keep Total and Pay now once, without Booking Fee line", () => {
    const view = mount(
      <BookingPriceDetails
        summary={{
          totalPrice: 240,
          rentalPrice: 200,
          pickupDeliveryCost: 0,
          returnDeliveryCost: 0,
        }}
        parts={{
          baseRentalMinor: 20000,
          insuranceMinor: 0,
          extrasMinor: 0,
          discountMinor: 0,
        }}
        split={{
          platformAmountMinor: 2640,
          supplierBalanceMinor: 21360,
          grossMinor: 24000,
        }}
      />
    );
    const text = view.container.textContent;
    expect(text).toContain("Booking summary");
    expect(text).toContain("Total");
    expect(text).toContain("€240.00");
    expect(text).toContain("Pay now");
    expect(text).toContain("€26.40");
    expect(text).not.toContain("Base rental");
    expect(text).not.toContain("Rovaro Booking Fee");
    expect(text).not.toContain("See when the Booking Fee is refunded");
    expect((text.match(/Pay now/g) || []).length).toBe(1);
    expect((text.match(/Total/g) || []).length).toBe(1);
    const toggle = view.container.querySelector('[aria-expanded="false"]');
    expect(toggle).not.toBeNull();
    act(() => toggle.click());
    const open = view.container.textContent;
    expect(open).toContain("Base rental");
    expect(open).toContain("€200.00");
    expect(open).toContain("Pick-up");
    expect(open).toContain("Free");
    expect(open).toContain("Return collection");
    expect(open).toContain("Pay at pickup");
    expect(open).toContain("€213.60");
    expect(open).not.toContain("Rovaro Booking Fee");
    expect((open.match(/Pay now/g) || []).length).toBe(1);
    expect((open.match(/Total/g) || []).length).toBe(1);
    expect(view.container.querySelector('[aria-expanded="true"]')).not.toBeNull();
    view.unmount();
  });
});
