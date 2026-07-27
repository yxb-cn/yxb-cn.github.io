import type { MetadataRoute } from "next";
import { absoluteSiteUrl, configuredSiteUrl } from "./seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const homepage = configuredSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    ...(homepage ? { sitemap: absoluteSiteUrl("sitemap.xml") } : {}),
  };
}
