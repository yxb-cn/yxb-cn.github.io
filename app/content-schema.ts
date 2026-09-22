import { defaultMainSections } from "./site-content";

export const currentContentSchemaVersion = 1.1;

export type ValidationIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function migrateSiteContent<T extends UnknownRecord>(content: T) {
  const next = clone(content) as UnknownRecord;
  const profile = isRecord(next.profile) ? next.profile : {};

  if (!Array.isArray(profile.facts)) {
    profile.facts = [
      { label: "Status", value: text(profile.status) },
      { label: "Job Market", value: text(profile.jobMarket) },
      { label: "Languages", value: text(profile.languages) },
    ].filter((item) => item.value);
  }
  if (!Array.isArray(profile.alternateNames)) {
    profile.alternateNames = [];
  }
  if (typeof profile.siteUrl !== "string") {
    profile.siteUrl = "";
  }

  delete profile.status;
  delete profile.jobMarket;
  delete profile.languages;
  next.profile = profile;

  if (!Array.isArray(next.mainSections) || next.mainSections.length === 0) {
    next.mainSections = clone(defaultMainSections);
  }
  if (Array.isArray(next.mainSections)) {
    next.mainSections.forEach((section) => {
      if (!isRecord(section)) {
        return;
      }
      const placement = text(section.navigationPlacement);
      section.navigationPlacement =
        placement === "top" ||
        placement === "more" ||
        placement === "hidden"
          ? placement
          : section.showInNavigation === false
            ? "hidden"
            : "top";
      section.showInNavigation = section.navigationPlacement !== "hidden";
    });
  }

  const analytics = isRecord(next.analytics) ? next.analytics : {};
  const providers = isRecord(analytics.providers) ? analytics.providers : {};
  const umami = isRecord(providers.umami) ? providers.umami : {};
  const fiftyOneLa = isRecord(providers.fiftyOneLa)
    ? providers.fiftyOneLa
    : {};
  const legacyUmamiEnabled =
    analytics.enabled === true &&
    (!text(analytics.provider) || text(analytics.provider) === "umami");

  next.analytics = {
    enabled: analytics.enabled === true,
    providers: {
      umami: {
        enabled:
          isRecord(providers.umami) && typeof umami.enabled === "boolean"
            ? umami.enabled
            : legacyUmamiEnabled,
        scriptUrl:
          text(umami.scriptUrl) ||
          text(analytics.scriptUrl) ||
          "https://cloud.umami.is/script.js",
        websiteId: text(umami.websiteId) || text(analytics.websiteId),
      },
      fiftyOneLa: {
        enabled:
          isRecord(providers.fiftyOneLa) &&
          fiftyOneLa.enabled === true,
        scriptUrl:
          text(fiftyOneLa.scriptUrl) ||
          "https://sdk.51.la/js-sdk-pro.min.js",
        siteId: text(fiftyOneLa.siteId),
        ck: text(fiftyOneLa.ck),
        hashMode:
          typeof fiftyOneLa.hashMode === "boolean"
            ? fiftyOneLa.hashMode
            : true,
      },
    },
  };

  const educationCollections: unknown[] = [next.education];
  if (Array.isArray(next.mainSections)) {
    for (const section of next.mainSections) {
      if (isRecord(section) && section.template === "education") {
        educationCollections.push(
          typeof section.dataKey === "string" ? next[section.dataKey] : section.content,
        );
      }
    }
  }
  for (const entries of educationCollections) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (isRecord(entry) && typeof entry.department !== "string") {
        entry.department = "";
      }
    }
  }

  const publicationCollections: unknown[] = [next.publicationGroups];
  if (Array.isArray(next.mainSections)) {
    for (const section of next.mainSections) {
      if (isRecord(section) && section.template === "publicationGroups") {
        publicationCollections.push(
          typeof section.dataKey === "string"
            ? next[section.dataKey]
            : section.content,
        );
      }
    }
  }
  for (const groups of publicationCollections) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isRecord(group) || !Array.isArray(group.papers)) continue;
      for (const paper of group.papers) {
        if (isRecord(paper) && typeof paper.presentations !== "string") {
          paper.presentations = "";
        }
      }
    }
  }

  next.schemaVersion = currentContentSchemaVersion;
  return next as T & { schemaVersion: number };
}

function validWebUrl(value: string) {
  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("mailto:")
  ) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function inspectLinks(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectLinks(item, `${path}[${index}]`, issues),
    );
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === "url" && typeof child === "string") {
      const url = child.trim();
      const hasCompanionText = Boolean(
        text(value.label) || text(value.text) || text(value.title),
      );
      if (!url && hasCompanionText) {
        issues.push({
          level: "warning",
          path: childPath,
          message: "This link has a label or title but no URL.",
        });
      } else if (url && !validWebUrl(url) && !validEmail(url)) {
        issues.push({
          level: "error",
          path: childPath,
          message: "Enter a complete URL, email address, or local /path.",
        });
      }
    }
    inspectLinks(child, childPath, issues);
  }
}

export function validateSiteContent(content: UnknownRecord) {
  const issues: ValidationIssue[] = [];
  const profile = isRecord(content.profile) ? content.profile : null;
  const analytics = isRecord(content.analytics) ? content.analytics : null;

  if (!profile) {
    issues.push({
      level: "error",
      path: "profile",
      message: "Profile information is required.",
    });
  } else {
    if (!text(profile.name)) {
      issues.push({
        level: "error",
        path: "profile.name",
        message: "English Name is required.",
      });
    }
    if (!text(profile.metaTitle)) {
      issues.push({
        level: "error",
        path: "profile.metaTitle",
        message: "Browser Title is required.",
      });
    }
    const siteUrl = text(profile.siteUrl);
    if (siteUrl && (!siteUrl.startsWith("https://") || !validWebUrl(siteUrl))) {
      issues.push({
        level: "error",
        path: "profile.siteUrl",
        message:
          "Enter a complete HTTPS URL, or leave this optional override empty so GitHub Pages can detect the published address automatically.",
      });
    }
    const description = text(profile.metaDescription);
    if (!description || /^search description$/i.test(description)) {
      issues.push({
        level: "warning",
        path: "profile.metaDescription",
        message:
          "Search Description is still empty or contains placeholder text.",
      });
    }
    if (!text(profile.cvPath)) {
      issues.push({
        level: "warning",
        path: "profile.cvPath",
        message: "No CV file is configured.",
      });
    }
  }

  if (!analytics) {
    issues.push({
      level: "error",
      path: "analytics",
      message: "Analytics settings have an invalid structure.",
    });
  } else if (analytics.enabled === true) {
    const providers = isRecord(analytics.providers)
      ? analytics.providers
      : null;
    const umami = providers && isRecord(providers.umami)
      ? providers.umami
      : null;
    const fiftyOneLa = providers && isRecord(providers.fiftyOneLa)
      ? providers.fiftyOneLa
      : null;
    const umamiEnabled = umami?.enabled === true;
    const fiftyOneLaEnabled = fiftyOneLa?.enabled === true;

    if (!providers) {
      issues.push({
        level: "error",
        path: "analytics.providers",
        message: "Analytics provider settings have an invalid structure.",
      });
    } else if (!umamiEnabled && !fiftyOneLaEnabled) {
      issues.push({
        level: "error",
        path: "analytics.providers",
        message:
          "Enable at least one analytics provider, or turn off Enable Analytics.",
      });
    }

    if (umamiEnabled && umami) {
      const scriptUrl = text(umami.scriptUrl);
      if (
        !scriptUrl ||
        !validWebUrl(scriptUrl) ||
        !scriptUrl.startsWith("https://")
      ) {
        issues.push({
          level: "error",
          path: "analytics.providers.umami.scriptUrl",
          message: "Enter the complete HTTPS Script URL from Umami.",
        });
      }
      if (!text(umami.websiteId)) {
        issues.push({
          level: "error",
          path: "analytics.providers.umami.websiteId",
          message: "Enter the Website ID before enabling Umami.",
        });
      }
    }

    if (fiftyOneLaEnabled && fiftyOneLa) {
      const scriptUrl = text(fiftyOneLa.scriptUrl);
      if (
        !scriptUrl ||
        !validWebUrl(scriptUrl) ||
        !scriptUrl.startsWith("https://")
      ) {
        issues.push({
          level: "error",
          path: "analytics.providers.fiftyOneLa.scriptUrl",
          message: "Enter the complete HTTPS Script URL from 51LA.",
        });
      }
      if (!text(fiftyOneLa.siteId)) {
        issues.push({
          level: "error",
          path: "analytics.providers.fiftyOneLa.siteId",
          message: "Enter the App ID before enabling 51LA.",
        });
      }
      if (!text(fiftyOneLa.ck)) {
        issues.push({
          level: "error",
          path: "analytics.providers.fiftyOneLa.ck",
          message: "Enter the CK value before enabling 51LA.",
        });
      }
    }
  }

  const sections = Array.isArray(content.mainSections)
    ? content.mainSections
    : [];
  if (sections.length === 0) {
    issues.push({
      level: "error",
      path: "mainSections",
      message: "At least one main section is required.",
    });
  } else {
    const ids = new Set<string>();
    sections.forEach((section, index) => {
      if (!isRecord(section)) {
        issues.push({
          level: "error",
          path: `mainSections[${index}]`,
          message: "This section has an invalid structure.",
        });
        return;
      }
      const id = text(section.id);
      if (!id) {
        issues.push({
          level: "error",
          path: `mainSections[${index}].id`,
          message: "Each section needs an ID.",
        });
      } else if (ids.has(id)) {
        issues.push({
          level: "error",
          path: `mainSections[${index}].id`,
          message: `The section ID “${id}” is duplicated.`,
        });
      }
      ids.add(id);
      if (!text(section.title)) {
        issues.push({
          level: "error",
          path: `mainSections[${index}].title`,
          message: "Each section needs a title.",
        });
      }
      if (!text(section.template)) {
        issues.push({
          level: "error",
          path: `mainSections[${index}].template`,
          message: "Each section needs a layout template.",
        });
      }
      const navigationPlacement = text(section.navigationPlacement);
      if (
        navigationPlacement &&
        navigationPlacement !== "top" &&
        navigationPlacement !== "more" &&
        navigationPlacement !== "hidden"
      ) {
        issues.push({
          level: "error",
          path: `mainSections[${index}].navigationPlacement`,
          message:
            "Navigation placement must be Top navigation, More menu, or Hidden.",
        });
      }

      if (text(section.template) === "pageCollection") {
        if (id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
          issues.push({
            level: "error",
            path: `mainSections[${index}].id`,
            message:
              "Independent page IDs may use lowercase letters, numbers, and hyphens.",
          });
        }

        const entries = Array.isArray(section.content)
          ? section.content
          : [];
        const slugs = new Set<string>();
        entries.forEach((entry, entryIndex) => {
          if (!isRecord(entry)) {
            issues.push({
              level: "error",
              path: `mainSections[${index}].content[${entryIndex}]`,
              message: "This page entry has an invalid structure.",
            });
            return;
          }

          const entryPath = `mainSections[${index}].content[${entryIndex}]`;
          const slug = text(entry.slug);
          if (!text(entry.title)) {
            issues.push({
              level: "error",
              path: `${entryPath}.title`,
              message: "Each independent page entry needs a title.",
            });
          }
          if (!slug) {
            issues.push({
              level: "error",
              path: `${entryPath}.slug`,
              message: "Each independent page entry needs a Page Slug.",
            });
          } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            issues.push({
              level: "error",
              path: `${entryPath}.slug`,
              message:
                "Page Slug may use lowercase letters, numbers, and hyphens.",
            });
          } else if (slugs.has(slug)) {
            issues.push({
              level: "error",
              path: `${entryPath}.slug`,
              message: `The Page Slug "${slug}" is duplicated in this section.`,
            });
          }
          slugs.add(slug);
        });
      }
    });
  }

  const contacts = Array.isArray(content.contacts) ? content.contacts : [];
  contacts.forEach((contact, contactIndex) => {
    if (!isRecord(contact) || !/email/i.test(text(contact.label))) {
      return;
    }
    const entries = Array.isArray(contact.entries) ? contact.entries : [];
    entries.forEach((entry, entryIndex) => {
      if (!isRecord(entry)) {
        return;
      }
      const candidate =
        text(entry.copyValue) || text(entry.url).replace(/^mailto:/i, "");
      if (candidate && !validEmail(candidate)) {
        issues.push({
          level: "error",
          path: `contacts[${contactIndex}].entries[${entryIndex}]`,
          message: "Enter a valid email address.",
        });
      }
    });
  });

  inspectLinks(content, "", issues);
  return issues;
}
