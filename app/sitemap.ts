import type { MetadataRoute } from "next";
import {
  getPublishedPageCollectionSections,
  visiblePageCollectionItems,
} from "./page-collections";
import { absoluteSiteUrl, configuredSiteUrl } from "./seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const homepage = configuredSiteUrl();
  if (!homepage) {
    return [];
  }

  const urls = [homepage];
  getPublishedPageCollectionSections().forEach((section) => {
    urls.push(absoluteSiteUrl(`${section.id}/`));
    visiblePageCollectionItems(section).forEach((item) => {
      urls.push(absoluteSiteUrl(`${section.id}/${item.slug}/`));
    });
  });

  return Array.from(new Set(urls))
    .filter(Boolean)
    .map((url) => ({ url }));
}
