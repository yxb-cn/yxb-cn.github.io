import { siteContent, type SiteContent } from "./site-content";

function uniqueText(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

export function configuredSiteUrl(content: SiteContent = siteContent) {
  const candidate = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    content.profile.siteUrl ||
    ""
  ).trim();

  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function absoluteSiteUrl(
  relativePath = "",
  content: SiteContent = siteContent,
) {
  const base = configuredSiteUrl(content);
  if (!base) {
    return "";
  }

  return new URL(relativePath.replace(/^\/+/, ""), base).toString();
}

function profileAlternateNames(content: SiteContent = siteContent) {
  return uniqueText([
    ...(content.profile.alternateNames ?? []),
    content.profile.nameChinese,
  ]).filter((name) => name !== content.profile.name.trim());
}

export function profileKeywords(content: SiteContent = siteContent) {
  return uniqueText([
    content.profile.name,
    ...profileAlternateNames(content),
    ...content.profile.interests,
    "academic homepage",
    "research",
    "publications",
    "researcher",
  ]);
}

function profileSameAs(content: SiteContent = siteContent) {
  return uniqueText(
    content.contacts.flatMap((contact) =>
      contact.entries.map((entry) => entry.url),
    ),
  ).filter((url) => /^https?:\/\//i.test(url));
}

export function profileStructuredData(content: SiteContent = siteContent) {
  const url = configuredSiteUrl(content);
  const image = absoluteSiteUrl(content.profile.photoPath, content);
  const alternateName = profileAlternateNames(content);
  const sameAs = profileSameAs(content);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    ...(url ? { url } : {}),
    mainEntity: {
      "@type": "Person",
      name: content.profile.name,
      ...(alternateName.length > 0 ? { alternateName } : {}),
      ...(content.profile.metaDescription.trim()
        ? { description: content.profile.metaDescription.trim() }
        : {}),
      ...(url ? { url } : {}),
      ...(image ? { image } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
