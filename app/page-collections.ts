import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultMainSections, siteContent } from "./site-content";
import type {
  MainSection,
  PageCollectionItem,
} from "./site-content";

export type PageCollectionSection = Omit<
  MainSection,
  "template" | "content"
> & {
  template: "pageCollection";
  content: PageCollectionItem[];
};

function isPageCollectionItem(item: unknown): item is PageCollectionItem {
  return (
    typeof item === "object" &&
    item !== null &&
    !Array.isArray(item) &&
    "title" in item &&
    typeof item.title === "string" &&
    "slug" in item &&
    typeof item.slug === "string"
  );
}

function markdownBody(item: PageCollectionItem) {
  if (typeof item.body === "string") {
    return item.body;
  }

  if (typeof item.markdownPath !== "string") {
    return "";
  }

  const isCurrentPath = item.markdownPath.startsWith("public/page-content/");
  const isLegacyPath = item.markdownPath.startsWith("content/pages/");
  if (!isCurrentPath && !isLegacyPath) {
    return "";
  }

  const prefix = isCurrentPath
    ? "public/page-content/"
    : "content/pages/";
  const pagesRoot = isCurrentPath
    ? path.join(process.cwd(), "public", "page-content")
    : path.join(process.cwd(), "content", "pages");
  const relativeMarkdownPath = item.markdownPath.slice(prefix.length);
  const filePath = path.join(pagesRoot, relativeMarkdownPath);
  const relative = path.relative(pagesRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return "";
  }

  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function getPageCollectionSections(): PageCollectionSection[] {
  const sections = siteContent.mainSections?.length
    ? siteContent.mainSections
    : defaultMainSections;

  return sections
    .filter(
      (section) =>
        section.template === "pageCollection" &&
        Array.isArray(section.content),
    )
    .map((section) => ({
      ...section,
      template: "pageCollection" as const,
      content: (section.content ?? [])
        .filter(isPageCollectionItem)
        .map((item) => ({ ...item, body: markdownBody(item) })),
    }));
}

export function getPublishedPageCollectionSections(): PageCollectionSection[] {
  return getPageCollectionSections().filter(
    (section) => section.showOnHomepage !== false,
  );
}

export function findPageCollection(
  sectionId: string,
): PageCollectionSection | undefined {
  return getPublishedPageCollectionSections().find(
    (section) => section.id === sectionId,
  );
}

export function visiblePageCollectionItems(
  section: PageCollectionSection,
): PageCollectionItem[] {
  return section.content.filter(
    (item) =>
      item.showOnHomepage !== false &&
      item.title.trim() &&
      item.slug.trim(),
  );
}
