/**
 * Every token used anywhere in the shipped documents must actually resolve.
 *
 * An unmatched `{{token}}` is left verbatim by the renderer, which would put
 * raw template syntax in front of a customer or a partner. This walks the
 * real content and fails if any placeholder survives rendering.
 */

import { getSeedDocuments } from "@/domain/legal/documentRegistry";
import { renderLegalDocument, buildTokenValues } from "@/domain/legal/tokens";
import {
  resolveLegalSettings,
  buildLegalSettingsTokens,
} from "@/domain/legal/legalSettings";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function tokensIn(text) {
  return [...String(text || "").matchAll(TOKEN_RE)].map((m) => m[1]);
}

function allTokens() {
  const found = new Set();
  for (const doc of getSeedDocuments()) {
    for (const value of [
      doc.content.title,
      ...doc.content.sections.flatMap((s) => [s.heading, s.body]),
    ]) {
      for (const token of tokensIn(value)) found.add(token);
    }
  }
  return [...found].sort();
}

function renderAll({ settings }) {
  return getSeedDocuments().map((doc) => ({
    doc,
    rendered: renderLegalDocument(doc, { settings }),
  }));
}

describe("token coverage", () => {
  const unconfigured = buildLegalSettingsTokens(resolveLegalSettings(null));

  it("resolves every token the documents reference", () => {
    const available = new Set([
      ...Object.keys(buildTokenValues({ settings: unconfigured })),
    ]);
    const missing = allTokens().filter((token) => !available.has(token));

    expect(missing).toEqual([]);
  });

  it("uses only operator and settings namespaces", () => {
    const badNamespace = allTokens().filter(
      (token) => !/^(operator|settings)\./.test(token)
    );
    expect(badNamespace).toEqual([]);
  });
});

describe("rendered output is clean", () => {
  const unconfigured = buildLegalSettingsTokens(resolveLegalSettings(null));
  const configured = buildLegalSettingsTokens(
    resolveLegalSettings({
      supplierCancellationServiceCharge: 50,
      replacementCostDifferenceCap: 200,
    })
  );

  for (const [label, settings] of [
    ["with nothing configured", unconfigured],
    ["with commercial amounts configured", configured],
  ]) {
    it(`leaves no unresolved placeholder ${label}`, () => {
      const leftovers = [];
      for (const { doc, rendered } of renderAll({ settings })) {
        const text = [
          rendered.title,
          ...rendered.sections.flatMap((s) => [s.heading, s.text]),
        ].join("\n");
        for (const token of tokensIn(text)) {
          leftovers.push(`${doc.documentType}.${doc.language}: {{${token}}}`);
        }
      }
      expect(leftovers).toEqual([]);
    });

    it(`produces no empty section ${label}`, () => {
      for (const { doc, rendered } of renderAll({ settings })) {
        for (const section of rendered.sections) {
          expect(section.text.trim().length).toBeGreaterThan(0);
        }
        expect(rendered.title.trim().length).toBeGreaterThan(0);
        expect(rendered.sections.length).toBeGreaterThan(5);
      }
    });
  }

  it("never renders a dangling amount when nothing is configured", () => {
    for (const { rendered } of renderAll({ settings: unconfigured })) {
      const text = rendered.sections.map((s) => s.text).join("\n");
      // "EUR ." or "of  per" style gaps left by a blanked value.
      expect(text).not.toMatch(/\bEUR\s*[.,]/);
      expect(text).not.toMatch(/ {3,}/);
    }
  });
});

describe("suppressed sections keep the documents readable", () => {
  it("drops address-dependent sections when no address is configured", () => {
    const settings = buildLegalSettingsTokens(resolveLegalSettings(null));
    for (const { doc, rendered } of renderAll({ settings })) {
      const declared = doc.content.sections.filter(
        (s) => (s.requires || []).length > 0
      ).length;
      expect(rendered.sections.length).toBe(
        doc.content.sections.length - declared
      );
    }
  });

  it("restores them once the values exist", () => {
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS = "A configured address";
    process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER = "TEST-123456";
    try {
      jest.isolateModules(() => {
        const { renderLegalDocument: render } = require("@/domain/legal/tokens");
        const { getSeedDocuments: seeds } = require("@/domain/legal/documentRegistry");
        for (const doc of seeds()) {
          const rendered = render(doc, { settings: {} });
          expect(rendered.sections.length).toBe(doc.content.sections.length);
        }
      });
    } finally {
      delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS;
      delete process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER;
    }
  });
});
