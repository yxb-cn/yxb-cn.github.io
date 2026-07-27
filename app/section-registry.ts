export const sectionRegistry = {
  about: {
    label: "About",
    description: "Profile, biography, research interests, and primary links.",
    editorMode: "profile",
    renderer: "about",
    defaultItem: null,
  },
  education: {
    label: "Education",
    description:
      "Maintain degrees, institutions, and fields in chronological order.",
    editorMode: "list",
    renderer: "education",
    defaultItem: {
      period: "",
      degree: "",
      institution: "",
      details: "",
    },
  },
  researchTopics: {
    label: "Research Topics",
    description:
      "Describe each research topic with a number, title, and short summary.",
    editorMode: "list",
    renderer: "researchTopics",
    defaultItem: { number: "", title: "", text: "" },
  },
  publicationGroups: {
    label: "Publications",
    description:
      "Manage papers, authors, abstracts, and links by publication status.",
    editorMode: "publicationGroups",
    renderer: "publicationGroups",
    defaultItem: {
      id: "",
      title: "",
      papers: [
        {
          showOnHomepage: true,
          type: "",
          year: "",
          title: "",
          url: "",
          authors: [{ name: "", self: false, corresponding: false }],
          venue: "",
          note: "",
          bibtex: "",
          abstract: "",
          links: [{ label: "", url: "" }],
        },
      ],
    },
  },
  projects: {
    label: "Research Grants & Fellowships",
    description:
      "Maintain research grants, fellowships, funders, and your role.",
    editorMode: "list",
    renderer: "projects",
    defaultItem: {
      type: "",
      period: "",
      title: "",
      funder: "",
      grantNumber: "",
      principalInvestigator: "",
      role: "",
    },
  },
  codeProjects: {
    label: "Data & Code",
    description:
      "Maintain GitHub projects, descriptions, and technology tags.",
    editorMode: "list",
    renderer: "codeProjects",
    defaultItem: {
      type: "",
      title: "",
      description: "",
      technologies: [""],
      url: "",
    },
  },
  talks: {
    label: "Conference Presentations",
    description:
      "Maintain presentation dates, event names, contribution, and locations.",
    editorMode: "list",
    renderer: "talks",
    defaultItem: {
      date: "",
      event: "",
      contribution: "",
      location: "",
    },
  },
  serviceAndSkills: {
    label: "Service & Skills",
    description:
      "Maintain reviewing service, software, and methodological skills.",
    editorMode: "list",
    renderer: "serviceAndSkills",
    defaultItem: { title: "", items: [""] },
  },
  pageCollection: {
    label: "Independent Pages",
    description:
      "Create a navigation destination such as Teaching or Blog, with compact entries that open full Markdown pages.",
    editorMode: "pageCollection",
    renderer: "pageCollection",
    defaultItem: {
      showOnHomepage: true,
      meta: "",
      title: "",
      slug: "",
      summary: "",
      body: "## Overview\n\nWrite the page content here using Markdown and LaTeX.",
    },
  },
} as const;

export type MainSectionTemplate = keyof typeof sectionRegistry;
export type MainSectionDataKey = Exclude<
  MainSectionTemplate,
  "about" | "pageCollection"
>;

export function getSectionDefinition(template: string) {
  return sectionRegistry[template as MainSectionTemplate];
}

export function getSectionDefaultItem(template: string): unknown {
  const definition = getSectionDefinition(template);
  if (!definition || definition.defaultItem === null) {
    return "";
  }
  return JSON.parse(JSON.stringify(definition.defaultItem)) as unknown;
}
