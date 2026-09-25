const fs = require("fs");
const path = require("path");

const editorSrc = fs.readFileSync(
  path.join(__dirname, "../CompanyOfficesEditor.js"),
  "utf8"
);

describe("CompanyOfficesEditor identity contract", () => {
  test("does not use array index as React key or shared setActive", () => {
    expect(editorSrc).not.toMatch(/key=\{index\}/);
    expect(editorSrc).not.toMatch(/key=\{`\$\{.*\}-\$\{index\}`\}/);
    expect(editorSrc).not.toMatch(/setActive\(/);
    expect(editorSrc).toMatch(/key=\{office\.id \|\| office\.clientId \|\| office\._id\}/);
  });

  test("every field identifier includes the office id", () => {
    expect(editorSrc).toMatch(
      /const fieldId = \(name\) => `office-\$\{officeId\}-\$\{name\}`/
    );
    expect(editorSrc).toMatch(/id=\{fieldId\("active"\)\}/);
    expect(editorSrc).toMatch(/name=\{fieldId\("active"\)\}/);
    expect(editorSrc).toMatch(/id=\{fieldId\("address"\)\}/);
    expect(editorSrc).toMatch(/updateOfficeByKey/);
    expect(editorSrc).toMatch(/createDefaultOffice\(\)/);
  });

  test("Active switch binds the current office only", () => {
    expect(editorSrc).toMatch(/checked=\{Boolean\(isActive\)\}/);
    expect(editorSrc).toMatch(/updateOffice\(officeId, \{[\s\S]*active:/);
  });

  test("persists drafts without database id via POST", () => {
    expect(editorSrc).toMatch(/if \(!persistedId\)/);
    expect(editorSrc).toMatch(/method: "POST"/);
    expect(editorSrc).toMatch(/Save office/);
  });
});
