import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Run after the production build to check the actual exported homepage.
const content = JSON.parse(readFileSync("content/site-content.json", "utf8"));
const html = readFileSync("out/index.html", "utf8");
const articles = [...html.matchAll(/<article class="talk-item">([\s\S]*?)<\/article>/g)];
const talks = content.mainSections
  .filter((section) => section.template === "talks" && section.showOnHomepage)
  .flatMap((section) => section.dataKey ? content[section.dataKey] : section.content ?? []);
assert.equal(articles.length, talks.length, "All visible talks must be rendered");
let blank = 0;
let populated = 0;
for (const [index, talk] of talks.entries()) {
  const body = articles[index][1];
  const details = body.match(/<div>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(details, "The conference title container must exist");
  if (talk.contribution.trim()) {
    assert.match(details, /<p>[\s\S]+<\/p>/, "Keep nonempty contribution details");
    populated += 1;
  } else {
    assert.doesNotMatch(details, /<p[\s>]/, "Empty contributions must not leave a paragraph that generates a separator");
    blank += 1;
  }
  assert.match(body, /class="talk-location"/, "Keep the conference location");
}
console.log(`Checked ${blank} empty and ${populated} populated conference contributions.`);
