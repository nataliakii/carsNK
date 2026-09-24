import {
  htmlToSections,
  inlineToMarkdown,
  markdownToHtml,
  sectionsToPlain,
} from "../documentMarkup";

describe("legal document markup formatting", () => {
  test("inlineToMarkdown keeps bold/italic with attributes and style spans", () => {
    expect(inlineToMarkdown('<b style="font-weight:bold">Who we are</b>')).toBe(
      "**Who we are**"
    );
    expect(inlineToMarkdown("<strong class=\"x\">Rovaro</strong>")).toBe("**Rovaro**");
    expect(
      inlineToMarkdown('<span style="font-weight: 700">platform</span>')
    ).toBe("**platform**");
    expect(
      inlineToMarkdown('<span style="font-style: italic">note</span>')
    ).toBe("*note*");
    expect(inlineToMarkdown("<i>and</i> <em>also</em>")).toBe("*and* *also*");
  });

  test("htmlToSections preserves bold across save round-trip into the editor", () => {
    const html =
      "<h2><b>Who we are</b></h2><p>Rovaro is the <strong>platform</strong> behind " +
      '<span style="font-weight:bold">{{operator.platformBrand}}</span>.</p>';
    const sections = htmlToSections(html, "Rovaro Booking Terms");
    expect(sections.sections[0].heading).toBe("**Who we are**");
    expect(sections.sections[0].body).toContain("**platform**");
    expect(sections.sections[0].body).toContain("**{{operator.platformBrand}}**");

    const plain = sectionsToPlain(sections.sections);
    expect(plain).toContain("## **Who we are**");
    expect(plain).toContain("**platform**");

    const back = markdownToHtml(plain);
    expect(back).toMatch(/<h2>.*<strong>Who we are<\/strong>.*<\/h2>/);
    expect(back).toContain("<strong>platform</strong>");
    expect(back).toContain("<strong>{{operator.platformBrand}}</strong>");
  });

  test("plain bold paragraphs survive html → sections → html", () => {
    const html = "<p><b>Who we are</b></p><p>Next line without marks.</p>";
    const { sections } = htmlToSections(html, "Doc");
    const back = markdownToHtml(sectionsToPlain(sections));
    expect(back).toContain("<strong>Who we are</strong>");
    expect(back).toContain("Next line without marks.");
  });
});
