import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineLatexText } from "../latex-text";
import {
  findPageCollection,
  getPublishedPageCollectionSections,
  visiblePageCollectionItems,
} from "../page-collections";
import { publicPath } from "../public-path";
import { absoluteSiteUrl } from "../seo";
import { siteContent } from "../site-content";
import { SubpageShell } from "../subpage-shell";

export const dynamicParams = false;

export function generateStaticParams() {
  const params = getPublishedPageCollectionSections().map((section) => ({
    sectionId: section.id,
  }));
  return params.length > 0 ? params : [{ sectionId: "_page-template" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}): Promise<Metadata> {
  const { sectionId } = await params;
  const section = findPageCollection(sectionId);

  if (!section) {
    return {};
  }

  return {
    title: section.title,
    description: `${section.title} by ${siteContent.profile.name}.`,
    ...(absoluteSiteUrl(`${section.id}/`)
      ? {
          alternates: {
            canonical: absoluteSiteUrl(`${section.id}/`),
          },
        }
      : {}),
  };
}

export default async function PageCollection({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  const section = findPageCollection(sectionId);

  if (!section) {
    notFound();
  }

  const items = visiblePageCollectionItems(section);

  return (
    <SubpageShell activeSectionId={section.id}>
      <section className="page-collection section-shell">
        <header className="subpage-title">
          <h1>
            <InlineLatexText text={section.title} />
          </h1>
        </header>

        <div className="page-collection-list">
          {items.map((item) => (
            <a
              className="page-collection-row"
              href={publicPath(`/${section.id}/${item.slug}/`)}
              key={item.slug}
            >
              <span className="page-collection-meta">
                <InlineLatexText text={item.meta} />
              </span>
              <span className="page-collection-copy">
                <strong>
                  <InlineLatexText text={item.title} />
                </strong>
                {item.summary && (
                  <span>
                    <InlineLatexText text={item.summary} />
                  </span>
                )}
              </span>
              <span className="page-collection-arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>

        {items.length === 0 && (
          <p className="page-collection-empty">
            No published entries are available yet.
          </p>
        )}
      </section>
    </SubpageShell>
  );
}
