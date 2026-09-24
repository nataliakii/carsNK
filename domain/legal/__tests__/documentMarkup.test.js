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
    expect(sections.sections[0].heading).toBe("Who we are");
    expect(sections.sections[0].body).toContain("**platform**");
    expect(sections.sections[0].body).toContain("**{{operator.platformBrand}}**");

    const plain = sectionsToPlain(sections.sections);
    expect(plain).toContain("## Who we are");
    expect(plain).toContain("**platform**");

    const back = markdownToHtml(plain);
    expect(back).toMatch(/<h2>Who we are<\/h2>/);
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

  test("published body markdown renders bold and italic instead of raw asterisks", () => {
    const html = markdownToHtml(
      "**Legal review status:** Pending legal counsel review. *(Remove this note once review is complete.)*"
    );
    expect(html).toContain("<strong>Legal review status:</strong>");
    expect(html).toContain(
      "<em>(Remove this note once review is complete.)</em>"
    );
    expect(html).not.toContain("**");
  });

  test("document-wide bold wrap does not make every paragraph strong", () => {
    const html =
      "<b><h2>Sobre esta Política</h2><p>Rovaro es una plataforma.</p>" +
      "<p>Segundo párrafo normal.</p></b>";
    const { sections } = htmlToSections(html, "Doc");
    expect(sections[0].heading).toBe("Sobre esta Política");
    expect(sections[0].body).toBe(
      "Rovaro es una plataforma.\nSegundo párrafo normal."
    );
    const back = markdownToHtml(sectionsToPlain(sections));
    expect(back).toContain("<h2>Sobre esta Política</h2>");
    expect(back).toContain("<p>Rovaro es una plataforma.");
    expect(back).not.toMatch(/<p><strong>/);
    expect(back).not.toContain("</strong></p>");
  });

  test("orphan ** markers cannot bold the whole document on render", () => {
    const broken = "## Doc\n\n**\n\n## Sobre\n\nRovaro text.\n**";
    const html = markdownToHtml(broken);
    expect(html).not.toMatch(/<p><strong>/);
    expect(html).toContain("<h2>Sobre</h2>");
    expect(html).toContain("<p>Rovaro text.");
  });

  test("paragraphs fully wrapped in ** render as normal text", () => {
    const damaged =
      "## Cookie Policy\n\n" +
      "**Rovaro usa cookies en el sitio.**\n\n" +
      "**Puede cambiar la configuración en cualquier momento.**\n\n" +
      "Inline **still bold** phrase stays.";
    const html = markdownToHtml(damaged);
    expect(html).toContain("<p>Rovaro usa cookies en el sitio.</p>");
    expect(html).toContain(
      "<p>Puede cambiar la configuración en cualquier momento.</p>"
    );
    expect(html).toContain("Inline <strong>still bold</strong> phrase stays.");
    expect(html).not.toContain(
      "<p><strong>Rovaro usa cookies en el sitio.</strong></p>"
    );
  });
});
