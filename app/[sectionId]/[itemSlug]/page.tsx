import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocumentMarkdown,
  documentHeadings,
} from "../../document-markdown";
import { InlineLatexText } from "../../latex-text";
import {
  findPageCollection,
  getPublishedPageCollectionSections,
  visiblePageCollectionItems,
} from "../../page-collections";
import { publicPath } from "../../public-path";
import { absoluteSiteUrl } from "../../seo";
import { SubpageShell } from "../../subpage-shell";

export const dynamicParams = false;

export function generateStaticParams() {
  const params = getPublishedPageCollectionSections().flatMap((section) =>
    visiblePageCollectionItems(section).map((item) => ({
      sectionId: section.id,
      itemSlug: item.slug,
    })),
  );
  return params.length > 0
    ? params
    : [{ sectionId: "_page-template", itemSlug: "_entry-template" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sectionId: string; itemSlug: string }>;
}): Promise<Metadata> {
  const { sectionId, itemSlug } = await params;
  const section = findPageCollection(sectionId);
  const item = section
    ? visiblePageCollectionItems(section).find(
        (candidate) => candidate.slug === itemSlug,
      )
    : null;

  if (!item) {
    return {};
  }

  return {
    title: item.title,
    description: item.summary,
    ...(absoluteSiteUrl(`${sectionId}/${itemSlug}/`)
      ? {
          alternates: {
            canonical: absoluteSiteUrl(`${sectionId}/${itemSlug}/`),
          },
        }
      : {}),
  };
}

export default async function PageCollectionEntry({
  params,
}: {
  params: Promise<{ sectionId: string; itemSlug: string }>;
}) {
  const { sectionId, itemSlug } = await params;
  const section = findPageCollection(sectionId);
  const item = section
    ? visiblePageCollectionItems(section).find(
        (candidate) => candidate.slug === itemSlug,
      )
    : null;

  if (!section || !item) {
    notFound();
  }

  const headings = documentHeadings(item.body);

  return (
    <SubpageShell activeSectionId={section.id}>
      <article className="document-page section-shell">
        <header className="document-title">
          <a href={publicPath(`/${section.id}/`)}>
            ← <InlineLatexText text={section.title} />
          </a>
          {item.meta && (
            <p>
              <InlineLatexText text={item.meta} />
            </p>
          )}
          <h1>
            <InlineLatexText text={item.title} />
          </h1>
          {item.summary && (
            <div className="document-summary">
              <InlineLatexText text={item.summary} />
            </div>
          )}
        </header>

        <div
          className={`document-layout${
            headings.length === 0 ? " without-toc" : ""
          }`}
        >
          {headings.length > 0 && (
            <aside className="document-toc" aria-label="On this page">
              <p>On this page</p>
              <nav>
                {headings.map((heading, index) => (
                  <a
                    className={`toc-depth-${heading.depth}`}
                    href={`#${heading.id}`}
                    key={`${heading.id}-${index}`}
                  >
                    {heading.title}
                  </a>
                ))}
              </nav>
            </aside>
          )}
          <div className="document-body">
            <DocumentMarkdown text={item.body} />
          </div>
        </div>
      </article>
    </SubpageShell>
  );
}
