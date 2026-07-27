import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "./globals.css";
import {
  absoluteSiteUrl,
  configuredSiteUrl,
  profileKeywords,
} from "./seo";
import { siteContent } from "./site-content";

const siteUrl = configuredSiteUrl();
const profileImage = absoluteSiteUrl(siteContent.profile.photoPath);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: siteContent.profile.metaTitle,
    template: `%s | ${siteContent.profile.name}`,
  },
  description: siteContent.profile.metaDescription,
  keywords: profileKeywords(),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: siteContent.profile.metaTitle,
    description: siteContent.profile.metaDescription,
    ...(siteUrl ? { url: siteUrl } : {}),
    ...(profileImage
      ? {
          images: [
            {
              url: profileImage,
              alt: siteContent.profile.name,
            },
          ],
        }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analytics = siteContent.analytics;
  const loadUmami =
    analytics.enabled &&
    analytics.provider === "umami" &&
    Boolean(analytics.scriptUrl.trim()) &&
    Boolean(analytics.websiteId.trim());

  return (
    <html
      lang="en"
      data-density="compact"
      data-education-style="compact"
      data-secondary-sections-style="compact"
      suppressHydrationWarning
    >
      <body>
        {children}
        {loadUmami && (
          <Script
            id="umami-analytics"
            strategy="afterInteractive"
            src={analytics.scriptUrl}
            data-website-id={analytics.websiteId}
          />
        )}
      </body>
    </html>
  );
}
