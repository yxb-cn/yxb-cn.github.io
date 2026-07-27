import type { Metadata } from "next";
import { HomePage } from "./home-page";
import {
  configuredSiteUrl,
  profileStructuredData,
  serializeStructuredData,
} from "./seo";

const siteUrl = configuredSiteUrl();

export const metadata: Metadata = siteUrl
  ? {
      alternates: {
        canonical: siteUrl,
      },
    }
  : {};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(profileStructuredData()),
        }}
      />
      <HomePage />
    </>
  );
}
