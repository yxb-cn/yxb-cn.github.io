import rawSiteContent from "../content/site-content.json";
import type {
  MainSectionDataKey,
  MainSectionTemplate,
} from "./section-registry";

export type { MainSectionTemplate } from "./section-registry";

export type ContentLink = {
  label: string;
  url: string;
};

export type PublicationAuthor = {
  name: string;
  self: boolean;
  corresponding: boolean;
};

type Publication = {
  showOnHomepage?: boolean;
  type: string;
  year: string;
  title: string;
  url: string;
  authors: PublicationAuthor[];
  venue: string;
  note: string;
  bibtex: string;
  abstract: string;
  links: ContentLink[];
};

export type NavigationPlacement = "top" | "more" | "hidden";

export type MainSection = {
  id: string;
  title: string;
  navigationLabel: string;
  showOnHomepage?: boolean;
  showInNavigation: boolean;
  navigationPlacement?: NavigationPlacement;
  template: MainSectionTemplate;
  dataKey?: MainSectionDataKey;
  content?: unknown[];
  fieldLabels?: Record<string, string>;
};

export function sectionNavigationPlacement(
  section: Pick<MainSection, "navigationPlacement" | "showInNavigation">,
): NavigationPlacement {
  if (
    section.navigationPlacement === "top" ||
    section.navigationPlacement === "more" ||
    section.navigationPlacement === "hidden"
  ) {
    return section.navigationPlacement;
  }
  return section.showInNavigation ? "top" : "hidden";
}

export type PageCollectionItem = {
  showOnHomepage?: boolean;
  meta: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  markdownPath?: string;
};

export const defaultMainSections: MainSection[] = [
  {
    id: "about",
    title: "About",
    navigationLabel: "About",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "about",
  },
  {
    id: "education",
    title: "Education",
    navigationLabel: "Education",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "education",
    dataKey: "education",
  },
  {
    id: "research",
    title: "Research Topics",
    navigationLabel: "Research Topics",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "researchTopics",
    dataKey: "researchTopics",
  },
  {
    id: "publications",
    title: "Publications",
    navigationLabel: "Publications",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "publicationGroups",
    dataKey: "publicationGroups",
  },
  {
    id: "projects",
    title: "Research Grants & Fellowships",
    navigationLabel: "Grants",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "projects",
    dataKey: "projects",
  },
  {
    id: "code",
    title: "Data & Code",
    navigationLabel: "Data & Code",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "codeProjects",
    dataKey: "codeProjects",
  },
  {
    id: "talks",
    title: "Conference Presentations",
    navigationLabel: "Presentations",
    showOnHomepage: true,
    showInNavigation: true,
    navigationPlacement: "top",
    template: "talks",
    dataKey: "talks",
  },
  {
    id: "service",
    title: "Service & Skills",
    navigationLabel: "Service & Skills",
    showOnHomepage: true,
    showInNavigation: false,
    navigationPlacement: "hidden",
    template: "serviceAndSkills",
    dataKey: "serviceAndSkills",
  },
];

export type SiteContent = {
  schemaVersion: number;
  analytics: {
    enabled: boolean;
    provider: "umami";
    scriptUrl: string;
    websiteId: string;
  };
  profile: {
    name: string;
    nameChinese: string;
    alternateNames: string[];
    initials: string;
    photoPath: string;
    navPhotoPath?: string;
    originalPhotoPath?: string;
    photoCrops?: {
      about: { zoom: number; x: number; y: number };
      nav: { zoom: number; x: number; y: number };
    };
    facts: Array<{
      label: string;
      value: string;
    }>;
    position: string;
    affiliation: string;
    bio: string[];
    interests: string[];
    lastUpdated: string;
    cvPath: string;
    publicationNote: string;
    copyrightYear: string;
    footerNote: string;
    siteUrl: string;
    metaTitle: string;
    metaDescription: string;
  };
  contacts: Array<{
    label: string;
    entries: Array<{
      text: string;
      url: string;
      copyValue: string;
    }>;
  }>;
  mainSections?: MainSection[];
  education: Array<{
    period: string;
    degree: string;
    institution: string;
    details: string;
  }>;
  researchTopics: Array<{
    number: string;
    title: string;
    text: string;
  }>;
  publicationGroups: Array<{
    id: string;
    title: string;
    papers: Publication[];
  }>;
  projects: Array<{
    type: string;
    period: string;
    title: string;
    funder: string;
    grantNumber: string;
    principalInvestigator: string;
    role: string;
  }>;
  codeProjects: Array<{
    type: string;
    title: string;
    description: string;
    technologies: string[];
    url: string;
  }>;
  talks: Array<{
    date: string;
    event: string;
    contribution: string;
    location: string;
  }>;
  serviceAndSkills: Array<{
    title: string;
    items: string[];
  }>;
};

export const siteContent = rawSiteContent as SiteContent;
