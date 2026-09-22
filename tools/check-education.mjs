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
const section = { id: "education", title: "Education", template: "education", dataKey: "education" };
const item = { period: "2026 — Present", institution: "Test University", degree: "Visiting Ph.D. Student", department: "School of Economics", details: "Advisor: Test\nFields: Econometrics" };
function render(entry) {
  return renderToStaticMarkup(createElement(MainContentSection, { section, content: { ...siteContent, education: [entry] } }));
}
const html = render(item);
assert.match(html, /<h3[^>]*>.*Test University.*education-separator.*Visiting Ph.D. Student.*<\/h3>/);
assert.match(html, /education-department/);
assert.ok(html.indexOf("School of Economics") > html.indexOf("</h3>"));
assert.match(html, /education-details[\s\S]*<\/p><\/div><\/article>/);
for (const entry of [{ ...item, degree: "" }, { ...item, institution: "" }]) {
  assert.ok(!render(entry).includes("education-separator"));
}
assert.ok(!render({ ...item, department: "", details: "" }).includes("education-department"));
assert.ok(!render({ ...item, department: "", details: "" }).includes("education-details"));
const legacy = { institution: "Department, Legacy University", degree: "Ph.D.", period: "2020", details: "" };
const input = { education: [legacy], mainSections: [{ id: "extra", template: "education", content: [legacy] }] };
const migrated = migrateSiteContent(input);
assert.equal(migrated.education[0].department, "");
assert.equal(migrated.education[0].institution, legacy.institution);
assert.equal(migrated.mainSections[0].content[0].department, "");
assert.ok(!("department" in legacy));
assert.deepEqual(migrateSiteContent(migrated), migrated);
console.log("Education rendering and migration checks passed.");
