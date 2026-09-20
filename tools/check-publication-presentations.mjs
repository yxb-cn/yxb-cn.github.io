import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile local application modules in memory; no fixtures touch site-content.json.
// Run with Node 22.15+ (registerHooks) after installing project dependencies.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", ".tsx"]) {
        if (existsSync(fileURLToPath(base) + suffix)) {
          return { url: base.href + suffix, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.(tsx?|json)$/.test(url) && !url.includes("/node_modules/")) {
      const source = readFileSync(new URL(url), "utf8");
      return {
        format: "module",
        shortCircuit: true,
        source: url.endsWith(".json")
          ? "export default " + source
          : ts.transpileModule(source, {
              compilerOptions: {
                module: ts.ModuleKind.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
                target: ts.ScriptTarget.ES2022,
              },
            }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { MainContentSection } = await import("../app/main-content-section.tsx");
const { migrateSiteContent } = await import("../app/content-schema.ts");
const { siteContent } = await import("../app/site-content.ts");
const section = { id: "papers", title: "Papers", template: "publicationGroups", dataKey: "publicationGroups" };
const basePaper = {
  showOnHomepage: true, type: "Journal", year: "2026", title: "Test Paper",
  url: "", authors: [], venue: "Test Journal", note: "Under review",
  bibtex: "", abstract: "Test abstract", links: [],
};
function render(presentations) {
  const paper = { ...basePaper, ...(presentations === undefined ? {} : { presentations }) };
  const content = { ...siteContent, publicationGroups: [{ id: "test", title: "Test", papers: [paper] }] };
  return renderToStaticMarkup(createElement(MainContentSection, { section, content }));
}
for (const value of [undefined, "", " \n\t\r\n "]) {
  assert.doesNotMatch(render(value), /publication-presentations|Presentations:/, "Blank presentations must leave no block or label");
}
const populated = render("  Conference A (2026)\r\n\r\n Seminar B (2025)  \n ");
assert.match(populated, /<strong>Presentations:<\/strong>/);
assert.match(populated, /Conference A \(2026\); Seminar B \(2025\)/);
assert.ok(populated.indexOf("Test Journal") < populated.indexOf("Presentations:"));
assert.ok(populated.indexOf("Presentations:") < populated.indexOf("publication-tools"));
assert.doesNotMatch(render("<script>alert(1)</script>"), /<script>/);
const awards = render("Forum (2026, **Outstanding Paper Award**)\nICES (2025, **Best Student Oral Presentation Award**)");
assert.match(awards, /<strong>Outstanding Paper Award<\/strong>/);
assert.match(awards, /<strong>Best Student Oral Presentation Award<\/strong>/);
const original = {
  ...siteContent,
  publicationGroups: [{ id: "test", title: "Test", papers: [basePaper, { ...basePaper, presentations: "Meeting A\nMeeting B" }] }],
  mainSections: [{ ...section, dataKey: undefined, content: [{ id: "custom", title: "Custom", papers: [basePaper] }] }],
};
const snapshot = JSON.stringify(original);
const migrated = migrateSiteContent(original);
assert.equal(migrated.publicationGroups[0].papers[0].presentations, "");
assert.equal(migrated.mainSections[0].content[0].papers[0].presentations, "");
assert.equal(JSON.stringify(original), snapshot, "Migration must not mutate the input");
const roundTrip = migrateSiteContent(JSON.parse(JSON.stringify(migrated)));
assert.equal(roundTrip.publicationGroups[0].papers[1].presentations, "Meeting A\nMeeting B");
assert.deepEqual(roundTrip, migrated, "Migration must be idempotent");
console.log("Publication presentations: rendering, empty values, ordering, escaping, migration and round-trip checks passed.");
