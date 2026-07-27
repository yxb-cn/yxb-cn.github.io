"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { unzipSync } from "fflate";
import { parseBibtexEntries, type BibtexImportEntry } from "../bibtex";
import { DocumentMarkdown } from "../document-markdown";
import {
  siteContent,
  type MainSectionTemplate,
} from "../site-content";
import {
  currentContentSchemaVersion,
  migrateSiteContent,
  validateSiteContent,
  type ValidationIssue,
} from "../content-schema";
import { publicPath } from "../public-path";
import {
  getSectionDefaultItem,
  getSectionDefinition,
  sectionRegistry,
} from "../section-registry";
import styles from "./editor.module.css";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type FieldPath = Array<string | number>;
type MovePaper = (sourcePath: FieldPath, targetPath: FieldPath) => void;

const endpoint = "/__content-editor";
const photoEndpoint = "/__profile-photo";
const pageFileEndpoint = "/__page-asset";
const maximumPhotoSize = 5 * 1024 * 1024;
const paperDragType = "application/x-homepage-publication";
const pageSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sectionLabels: Record<string, string> = {
  siteSettings: "Site Settings",
  mainSections: "Main Sections",
  profile: "Profile",
  contacts: "Contact Links",
  analytics: "Analytics",
  education: "Education",
  researchTopics: "Research Topics",
  publicationGroups: "Publications",
  projects: "Research Grants & Fellowships",
  codeProjects: "Data & Code",
  talks: "Conference Presentations",
  serviceAndSkills: "Service & Skills",
};

const sectionDescriptions: Record<string, string> = {
  siteSettings:
    "Manage the site structure, profile and contact links, and analytics from one control page.",
  mainSections:
    "Add, reorder, rename, and configure the homepage sections and navigation.",
  profile:
    "Manage names, job-market status, biography, CV, and search metadata.",
  contacts: "Manage email, Google Scholar, SSRN, GitHub, ORCID, and other links.",
  analytics:
    "Turn privacy-friendly visitor analytics on or off without editing code.",
};

const fieldLabels: Record<string, string> = {
  name: "English Name",
  nameChinese: "Chinese Name",
  alternateNames: "Alternate Names",
  initials: "Fallback Initials",
  photoPath: "Profile Photo",
  navPhotoPath: "Navigation Photo",
  originalPhotoPath: "Original Photo",
  photoCrops: "Photo Crops",
  facts: "Profile Facts",
  value: "Value",
  position: "Position / Role",
  affiliation: "Department / Institution",
  bio: "Biography",
  interests: "Homepage Research Interests",
  lastUpdated: "Last Updated",
  cvPath: "CV File Path",
  publicationNote: "Publication Note",
  copyrightYear: "Copyright Year",
  footerNote: "Footer Note",
  siteUrl: "Published Site URL (optional override)",
  metaTitle: "Browser Title",
  metaDescription: "Search Description",
  label: "Label",
  entries: "Links",
  text: "Display Text",
  url: "URL",
  copyValue: "Copy Value",
  period: "Period",
  degree: "Degree",
  institution: "Institution",
  details: "Details",
  number: "Number",
  title: "Title",
  publicationGroups: "Publication Groups",
  papers: "Papers",
  showOnHomepage: "Visible on Site",
  type: "Type",
  year: "Year",
  authors: "Authors",
  self: "This Is Me",
  corresponding: "Corresponding Author",
  venue: "Journal / Conference",
  note: "Status / Note",
  bibtex: "BibTeX (optional — journal, volume, issue, and pages)",
  abstract:
    "Abstract (supports Markdown and LaTeX: **bold**, *italic*, $...$, $$...$$)",
  links: "Related Links",
  funder: "Funder",
  grantNumber: "Project / Award Number",
  principalInvestigator: "Principal Investigator / Host Institution",
  role: "Your Role",
  description: "Description",
  technologies: "Software / Technologies",
  date: "Date",
  event: "Event",
  contribution: "Participation",
  location: "Location",
  items: "Items",
  navigationLabel: "Navigation Text",
  showInNavigation: "Navigation Placement",
  template: "Layout Template",
  content: "Section Content",
  enabled: "Enable Analytics",
  provider: "Provider",
  scriptUrl: "Script URL",
  websiteId: "Website ID",
  slug: "Page Slug",
  meta: "Date / Term / Category",
  summary: "Short Summary",
  body: "Page Content (Markdown and LaTeX)",
};

const addLabels: Record<string, string> = {
  facts: "Add Profile Fact",
  alternateNames: "Add Alternate Name",
  contacts: "Add Contact Method",
  entries: "Add Link",
  education: "Add Education",
  researchTopics: "Add Research Topic",
  publicationGroups: "Add Publication Group",
  papers: "Add Paper",
  authors: "Add Author",
  links: "Add Paper Link",
  projects: "Add Grant / Fellowship",
  codeProjects: "Add Code Project",
  technologies: "Add Technology",
  talks: "Add Conference Presentation",
  serviceAndSkills: "Add Group",
  pageCollection: "Add Page",
  items: "Add Item",
  bio: "Add Paragraph",
  interests: "Add Research Interest",
};

const longTextFields = new Set([
  "bio",
  "text",
  "details",
  "abstract",
  "bibtex",
  "description",
  "metaDescription",
  "publicationNote",
  "summary",
  "body",
]);

const arrayTemplates: Record<string, JsonValue> = {
  facts: { label: "", value: "" },
  alternateNames: "",
  contacts: {
    label: "",
    entries: [{ text: "", url: "", copyValue: "" }],
  },
  entries: { text: "", url: "", copyValue: "" },
  papers: {
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
  authors: { name: "", self: false, corresponding: false },
  links: { label: "", url: "" },
  bio: "",
  interests: "",
  technologies: "",
  items: "",
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function ensureMainSections(content: JsonObject) {
  return migrateSiteContent(content) as JsonObject;
}

function updatePath(root: JsonObject, path: FieldPath, value: JsonValue) {
  const next = cloneValue(root);
  let cursor: JsonObject | JsonValue[] = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index] as never] as JsonObject | JsonValue[];
  }

  cursor[path[path.length - 1] as never] = value as never;
  return next;
}

function titleForItem(item: JsonObject, index: number) {
  const title =
    item.title ??
    item.degree ??
    item.event ??
    item.label ??
    item.name ??
    item.text ??
    item.institution ??
    item.venue ??
    item.type ??
    "";
  return typeof title === "string" && title.trim()
    ? title
    : `Item ${index + 1}`;
}

function parseValidationPath(path: string): FieldPath {
  const parts: FieldPath = [];
  path.replace(/([^[.\]]+)|\[(\d+)\]/g, (_, key: string, index: string) => {
    parts.push(index === undefined ? key : Number(index));
    return "";
  });
  return parts;
}

function valueAtPath(root: JsonValue, path: FieldPath): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
    } else {
      if (!isJsonObject(current)) {
        return undefined;
      }
      current = current[part];
    }
  }
  return current;
}

function editorTargetId(path: FieldPath) {
  return `editor-target-${path
    .map((part) =>
      typeof part === "number"
        ? `item-${part}`
        : part.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    )
    .join("--")}`;
}

type ValidationLocation = {
  label: string;
  sectionKey: string;
  settingsPanel?: "sections" | "profile" | "analytics";
  targetPath: FieldPath;
  itemPaths: FieldPath[];
};

function validationLocation(
  issue: ValidationIssue,
  content: JsonObject,
): ValidationLocation {
  const targetPath = parseValidationPath(issue.path);
  const rootKey =
    typeof targetPath[0] === "string" ? targetPath[0] : "siteSettings";
  const sections = Array.isArray(content.mainSections)
    ? content.mainSections
    : [];
  const itemPaths: FieldPath[] = [];
  const itemLabels: string[] = [];
  let sectionLabel = sectionLabels[rootKey] ?? rootKey;
  let sectionKey = rootKey;
  let settingsPanel: ValidationLocation["settingsPanel"];

  if (rootKey === "profile" || rootKey === "contacts") {
    sectionLabel = "Profile & Contact";
    sectionKey = "siteSettings";
    settingsPanel = "profile";
  } else if (rootKey === "analytics") {
    sectionLabel = "Analytics";
    sectionKey = "siteSettings";
    settingsPanel = "analytics";
  } else if (rootKey === "mainSections") {
    const sectionIndex =
      typeof targetPath[1] === "number" ? targetPath[1] : -1;
    const section =
      sectionIndex >= 0 && isJsonObject(sections[sectionIndex])
        ? sections[sectionIndex]
        : null;
    sectionLabel =
      (section && sectionText(section, "title")) || "Main Sections";

    if (
      section &&
      targetPath[2] === "content" &&
      typeof targetPath[3] === "number"
    ) {
      const dataKey = sectionText(section, "dataKey");
      const sectionId = sectionText(section, "id");
      sectionKey = dataKey || `custom:${sectionId}`;
      const itemPath = targetPath.slice(0, 4);
      const item = valueAtPath(content, itemPath);
      itemPaths.push(itemPath);
      itemLabels.push(
        isJsonObject(item)
          ? titleForItem(item, targetPath[3] as number)
          : `Item ${(targetPath[3] as number) + 1}`,
      );
    } else {
      sectionKey = "siteSettings";
      settingsPanel = "sections";
      if (sectionIndex >= 0) {
        itemPaths.push(targetPath.slice(0, 2));
      }
    }
  } else {
    const configuredSection = sections.find(
      (section) =>
        isJsonObject(section) &&
        sectionText(section, "dataKey") === rootKey,
    );
    if (isJsonObject(configuredSection)) {
      sectionLabel =
        sectionText(configuredSection, "title") || sectionLabel;
    }

    targetPath.forEach((part, index) => {
      if (typeof part !== "number") {
        return;
      }
      const itemPath = targetPath.slice(0, index + 1);
      const item = valueAtPath(content, itemPath);
      itemPaths.push(itemPath);
      itemLabels.push(
        isJsonObject(item)
          ? titleForItem(item, part)
          : `Item ${part + 1}`,
      );
    });
  }

  const lastPart = targetPath[targetPath.length - 1];
  const field =
    typeof lastPart === "string"
      ? fieldLabels[lastPart] ?? lastPart
      : "";
  const details = [
    `Section: ${sectionLabel}`,
    itemLabels.length > 0 ? `Item: ${itemLabels.join(" → ")}` : "",
    field ? `Field: ${field}` : "",
  ].filter(Boolean);

  return {
    label: details.join(" · "),
    sectionKey,
    settingsPanel,
    targetPath,
    itemPaths,
  };
}

function makeArrayItem(keyName: string, currentItems: JsonValue[]) {
  const registeredTemplate = getSectionDefinition(keyName);
  const template = registeredTemplate
    ? (getSectionDefaultItem(keyName) as JsonValue)
    : arrayTemplates[keyName] ?? currentItems[0] ?? "";
  const next = cloneValue(template);

  if (
    keyName === "publicationGroups" &&
    isJsonObject(next) &&
    typeof next.id === "string"
  ) {
    next.id = `group-${Date.now()}`;
  }

  return next;
}

function publicationTypeForBibtex(entryType: string) {
  if (entryType === "article") {
    return "Journal";
  }
  if (entryType === "inproceedings" || entryType === "conference") {
    return "Conference";
  }
  return "Working Paper";
}

function publicationFromBibtex(entry: BibtexImportEntry): JsonObject {
  return {
    showOnHomepage: true,
    type: publicationTypeForBibtex(entry.entryType),
    year: entry.year,
    title: entry.title,
    url: entry.url,
    authors: entry.authors.map((name) => ({
      name,
      self: false,
      corresponding: false,
    })),
    venue: entry.venue,
    note: entry.note,
    bibtex: entry.raw,
    abstract: entry.abstract,
    links: [],
  };
}

type CropState = {
  zoom: number;
  x: number;
  y: number;
};

type CropRectangle = {
  sx: number;
  sy: number;
  width: number;
  height: number;
};

function defaultCrop(): CropState {
  return { zoom: 1, x: 0.5, y: 0.5 };
}

function savedCrop(content: JsonObject, kind: "about" | "nav"): CropState {
  const profile = isJsonObject(content.profile) ? content.profile : null;
  const photoCrops = profile && isJsonObject(profile.photoCrops)
    ? profile.photoCrops
    : null;
  const crop =
    photoCrops && isJsonObject(photoCrops[kind]) ? photoCrops[kind] : null;
  const zoom = typeof crop?.zoom === "number" ? crop.zoom : 1;
  const x = typeof crop?.x === "number" ? crop.x : 0.5;
  const y = typeof crop?.y === "number" ? crop.y : 0.5;

  return {
    zoom: clamp(zoom, 1, 3),
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getCropRectangle(
  imageWidth: number,
  imageHeight: number,
  targetAspect: number,
  crop: CropState,
): CropRectangle {
  const imageAspect = imageWidth / imageHeight;
  let baseWidth: number;
  let baseHeight: number;

  if (imageAspect > targetAspect) {
    baseHeight = imageHeight;
    baseWidth = baseHeight * targetAspect;
  } else {
    baseWidth = imageWidth;
    baseHeight = baseWidth / targetAspect;
  }

  const width = baseWidth / crop.zoom;
  const height = baseHeight / crop.zoom;
  const availableX = Math.max(0, imageWidth - width);
  const availableY = Math.max(0, imageHeight - height);

  return {
    sx: availableX * crop.x,
    sy: availableY * crop.y,
    width,
    height,
  };
}

async function loadPhoto(source: File | string) {
  const objectUrl =
    typeof source === "string" ? source : URL.createObjectURL(source);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The selected photo could not be opened."));
      image.src = objectUrl;
    });
  } finally {
    if (typeof source !== "string") {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function createCroppedPhoto(
  image: HTMLImageElement,
  crop: CropState,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser could not prepare the cropped photo.");
  }

  const rectangle = getCropRectangle(
    image.naturalWidth,
    image.naturalHeight,
    width / height,
    crop,
  );

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    rectangle.sx,
    rectangle.sy,
    rectangle.width,
    rectangle.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9);
  });

  if (!blob) {
    throw new Error("The cropped photo could not be created.");
  }

  return blob;
}

async function uploadPhoto(
  blob: Blob,
  kind: "about" | "nav" | "original",
) {
  const response = await fetch(`${photoEndpoint}?kind=${kind}`, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  const result = (await response.json()) as {
    saved?: boolean;
    path?: string;
    error?: string;
  };

  if (!response.ok || !result.saved || !result.path) {
    throw new Error(result.error ?? "The cropped photo could not be saved.");
  }

  return result.path;
}

function imageContentType(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    }[extension ?? ""] ?? ""
  );
}

function pageFileContentType(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : imageContentType(fileName);
}

function isSupportedPageImage(fileName: string) {
  return Boolean(imageContentType(fileName));
}

function isSupportedPageFile(fileName: string) {
  return Boolean(pageFileContentType(fileName));
}

function normalizeBundlePath(filePath: string) {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}

function resolveBundlePath(baseDirectory: string, reference: string) {
  const parts = `${baseDirectory}/${reference}`
    .replaceAll("\\", "/")
    .split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

async function uploadPageFile(
  blob: Blob,
  fileName: string,
  sectionId: string,
  slug: string,
) {
  const contentType = blob.type || pageFileContentType(fileName);
  const query = new URLSearchParams({
    section: sectionId,
    slug,
    name: fileName,
  });
  const response = await fetch(`${pageFileEndpoint}?${query}`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  const result = (await response.json()) as {
    saved?: boolean;
    path?: string;
    error?: string;
  };

  if (!response.ok || !result.saved || !result.path) {
    throw new Error(result.error ?? "The page file could not be saved.");
  }

  return result.path;
}

type MarkdownImportFile = {
  path: string;
  file: File;
};

async function replaceImportedFilePaths(
  markdown: string,
  markdownPath: string,
  files: MarkdownImportFile[],
  sectionId: string,
  slug: string,
) {
  const markdownDirectory = normalizeBundlePath(markdownPath)
    .split("/")
    .slice(0, -1)
    .join("/");
  const byPath = new Map(
    files.map((item) => [
      normalizeBundlePath(item.path).toLowerCase(),
      item.file,
    ]),
  );
  const byName = new Map<string, File[]>();
  for (const item of files) {
    const name = item.file.name.toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), item.file]);
  }

  const pattern =
    /!?\[([^\]]*)]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  const matches = [...markdown.matchAll(pattern)];
  if (matches.length === 0) {
    return {
      markdown,
      imported: 0,
      missing: [] as string[],
      uploadedFiles: [] as Array<{ name: string; path: string }>,
    };
  }

  let cursor = 0;
  let output = "";
  let imported = 0;
  const missing: string[] = [];
  const uploadedPaths = new Map<string, string>();
  const uploadedFiles: Array<{ name: string; path: string }> = [];

  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    output += markdown.slice(cursor, matchIndex);
    const reference = match[2] || match[3];
    const external =
      /^(?:https?:|data:|\/|#)/i.test(reference) ||
      reference.startsWith("mailto:");

    if (external) {
      output += match[0];
      cursor = matchIndex + match[0].length;
      continue;
    }

    const cleanReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    const resolvedPath = resolveBundlePath(
      markdownDirectory,
      cleanReference,
    );
    const fallbackName = cleanReference.split("/").pop()?.toLowerCase() ?? "";
    const fallbackFiles = byName.get(fallbackName) ?? [];
    const assetFile =
      byPath.get(normalizeBundlePath(resolvedPath).toLowerCase()) ||
      (fallbackFiles.length === 1 ? fallbackFiles[0] : undefined);

    if (!assetFile || !isSupportedPageFile(assetFile.name)) {
      if (isSupportedPageFile(cleanReference)) {
        missing.push(reference);
      }
      output += match[0];
      cursor = matchIndex + match[0].length;
      continue;
    }

    let uploadedPath = uploadedPaths.get(resolvedPath);
    if (!uploadedPath) {
      uploadedPath = await uploadPageFile(
        assetFile,
        assetFile.name,
        sectionId,
        slug,
      );
      uploadedPaths.set(resolvedPath, uploadedPath);
      uploadedFiles.push({
        name: assetFile.name,
        path: uploadedPath,
      });
      imported += 1;
    }

    output += match[0].replace(reference, uploadedPath);
    cursor = matchIndex + match[0].length;
  }

  output += markdown.slice(cursor);
  return { markdown: output, imported, missing, uploadedFiles };
}

function fieldLabelPathKey(path: FieldPath) {
  const stringParts = path.filter(
    (part): part is string => typeof part === "string",
  );
  if (stringParts[0] === "mainSections") {
    const contentIndex = stringParts.indexOf("content");
    return contentIndex >= 0
      ? stringParts.slice(contentIndex + 1).join(".")
      : "";
  }
  return stringParts.slice(1).join(".");
}

function EditableFieldLabel({
  defaultLabel,
  labelKey,
  customLabels,
  onLabelChange,
}: {
  defaultLabel: string;
  labelKey: string;
  customLabels?: JsonObject;
  onLabelChange?: (labelKey: string, label: string) => void;
}) {
  const customLabel =
    customLabels && typeof customLabels[labelKey] === "string"
      ? customLabels[labelKey]
      : "";
  const label = customLabel || defaultLabel;
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);

  function beginEditing() {
    if (!onLabelChange || !labelKey) {
      return;
    }
    setDraftLabel(label);
    setEditing(true);
  }

  function commit() {
    const nextLabel = draftLabel.trim() || defaultLabel;
    onLabelChange?.(labelKey, nextLabel);
    setDraftLabel(nextLabel);
    setEditing(false);
  }

  if (!onLabelChange || !labelKey) {
    return <span>{label}</span>;
  }

  if (editing) {
    return (
      <input
        className={styles.fieldLabelEditor}
        autoFocus
        value={draftLabel}
        aria-label={`Rename ${label}`}
        onChange={(event) => setDraftLabel(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraftLabel(label);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className={styles.editableFieldLabel}
      type="button"
      title="Click to rename this field"
      onClick={beginEditing}
    >
      {label}
    </button>
  );
}

function EditorField({
  fieldKey,
  value,
  path,
  onChange,
  customLabels,
  onLabelChange,
}: {
  fieldKey: string;
  value: JsonPrimitive;
  path: FieldPath;
  onChange: (path: FieldPath, value: JsonValue) => void;
  customLabels?: JsonObject;
  onLabelChange?: (labelKey: string, label: string) => void;
}) {
  const label = fieldLabels[fieldKey] ?? fieldKey;
  const labelKey = fieldLabelPathKey(path);
  const inputId = useId();
  const editableLabel = (
    <EditableFieldLabel
      defaultLabel={label}
      labelKey={labelKey}
      customLabels={customLabels}
      onLabelChange={onLabelChange}
    />
  );

  if (typeof value === "boolean") {
    return (
      <div
        className={styles.checkboxField}
        id={editorTargetId(path)}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(path, event.target.checked)}
        />
        {editableLabel}
      </div>
    );
  }

  const stringValue = value === null ? "" : String(value);
  const multiline =
    longTextFields.has(fieldKey) || stringValue.length > 90;
  const inputType =
    fieldKey === "url" ||
    fieldKey === "scriptUrl" ||
    fieldKey === "siteUrl"
      ? "url"
      : "text";

  if (fieldKey === "provider") {
    return (
      <div className={styles.field} id={editorTargetId(path)}>
        <div className={styles.fieldLabelRow}>{editableLabel}</div>
        <select
          id={inputId}
          aria-label={label}
          value={stringValue}
          onChange={(event) => onChange(path, event.target.value)}
        >
          <option value="umami">Umami</option>
        </select>
      </div>
    );
  }

  return (
    <div className={styles.field} id={editorTargetId(path)}>
      <div className={styles.fieldLabelRow}>{editableLabel}</div>
      {multiline ? (
        <textarea
          id={inputId}
          aria-label={label}
          rows={
            fieldKey === "body"
              ? Math.min(
                  22,
                  Math.max(12, Math.ceil(stringValue.length / 75)),
                )
              : Math.min(
                  8,
                  Math.max(3, Math.ceil(stringValue.length / 75)),
                )
          }
          value={stringValue}
          onChange={(event) => onChange(path, event.target.value)}
        />
      ) : (
        <input
          id={inputId}
          aria-label={label}
          type={inputType}
          value={stringValue}
          onChange={(event) =>
            onChange(
              path,
              typeof value === "number"
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </div>
  );
}

function PageCollectionItemEditor({
  item,
  path,
  sectionId,
  onChange,
  customLabels,
  onLabelChange,
}: {
  item: JsonObject;
  path: FieldPath;
  sectionId: string;
  onChange: (path: FieldPath, value: JsonValue) => void;
  customLabels?: JsonObject;
  onLabelChange?: (labelKey: string, label: string) => void;
}) {
  const metadata = Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => key !== "body" && key !== "markdownPath",
    ),
  ) as JsonObject;
  const body = typeof item.body === "string" ? item.body : "";
  const slug = typeof item.slug === "string" ? item.slug.trim() : "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"write" | "split" | "preview">("split");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [recentUploads, setRecentUploads] = useState<
    Array<{ name: string; path: string }>
  >([]);
  const [copiedPath, setCopiedPath] = useState("");

  function uploadIdentity() {
    if (!sectionId || !pageSlugPattern.test(slug)) {
      throw new Error(
        "Add a lowercase URL slug first (for example: asset-pricing-notes).",
      );
    }
    return { sectionId, slug };
  }

  function replaceBody(nextBody: string) {
    onChange([...path, "body"], nextBody);
  }

  function insertAtSelection(markdown: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix =
      start > 0 && body[start - 1] !== "\n" && !markdown.startsWith("\n")
        ? "\n"
        : "";
    const suffix =
      end < body.length && body[end] !== "\n" && !markdown.endsWith("\n")
        ? "\n"
        : "";
    const inserted = `${prefix}${markdown}${suffix}`;
    replaceBody(`${body.slice(0, start)}${inserted}${body.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + inserted.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  async function addPageFiles(files: File[]) {
    const supported = files.filter((file) => isSupportedPageFile(file.name));
    if (supported.length === 0) {
      setStatus("Choose JPG, PNG, WebP, GIF, or PDF files.");
      return;
    }

    try {
      const identity = uploadIdentity();
      setBusy(true);
      setStatus(
        `Saving ${supported.length} file${supported.length === 1 ? "" : "s"}…`,
      );
      const uploaded = await Promise.all(
        supported.map(async (file) => ({
          file,
          path: await uploadPageFile(
            file,
            file.name,
            identity.sectionId,
            identity.slug,
          ),
        })),
      );
      setRecentUploads(
        uploaded.map(({ file, path: filePath }) => ({
          name: file.name,
          path: filePath,
        })),
      );
      insertAtSelection(
        uploaded.map(({ file, path: filePath }) => {
          const label = file.name
            .replace(/\.[^.]+$/, "")
            .replaceAll("-", " ");
          return isSupportedPageImage(file.name)
            ? `![${label}](${filePath})`
            : `[${file.name}](${filePath})`;
        }).join("\n\n"),
      );
      setStatus(
        `Added ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "The file could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importBundle(files: MarkdownImportFile[]) {
    const markdownFiles = files
      .filter((item) => item.path.toLowerCase().endsWith(".md"))
      .sort((left, right) => left.path.localeCompare(right.path));
    if (markdownFiles.length === 0) {
      setStatus("No Markdown (.md) file was found.");
      return;
    }

    try {
      const identity = uploadIdentity();
      setBusy(true);
      const selectedMarkdown = markdownFiles[0];
      setStatus(`Importing ${selectedMarkdown.file.name}…`);
      const imported = await replaceImportedFilePaths(
        await selectedMarkdown.file.text(),
        selectedMarkdown.path,
        files,
        identity.sectionId,
        identity.slug,
      );
      setRecentUploads(imported.uploadedFiles);
      replaceBody(imported.markdown);
      const missingText = imported.missing.length
        ? ` ${imported.missing.length} referenced file${
            imported.missing.length === 1 ? " was" : "s were"
          } not included and should be added manually.`
        : "";
      setStatus(
        `Imported ${selectedMarkdown.file.name} and ${imported.imported} file${
          imported.imported === 1 ? "" : "s"
        }.${missingText}`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The Markdown bundle could not be imported.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importZip(file: File | null) {
    if (!file) {
      return;
    }

    try {
      setBusy(true);
      setStatus(`Opening ${file.name}…`);
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const files: MarkdownImportFile[] = Object.entries(archive)
        .filter(([entryPath]) => !entryPath.endsWith("/"))
        .map(([entryPath, bytes]) => {
          const fileName = entryPath.split("/").pop() || "file";
          const contentType = entryPath.toLowerCase().endsWith(".md")
            ? "text/markdown"
            : pageFileContentType(fileName);
          return {
            path: entryPath,
            file: new File([bytes.slice().buffer], fileName, {
              type: contentType,
            }),
          };
        });
      await importBundle(files);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The ZIP archive could not be imported.",
      );
      setBusy(false);
    }
  }

  function importSelectedFiles(files: FileList | null, fromFolder = false) {
    if (!files?.length) {
      return;
    }
    void importBundle(
      [...files].map((file) => ({
        path:
          fromFolder && file.webkitRelativePath
            ? file.webkitRelativePath
            : file.name,
        file,
      })),
    );
  }

  function pasteFiles(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files].filter((file) =>
      isSupportedPageFile(file.name),
    );
    if (files.length > 0) {
      event.preventDefault();
      void addPageFiles(files);
    }
  }

  function dropFiles(event: ReactDragEvent<HTMLTextAreaElement>) {
    const files = [...event.dataTransfer.files].filter((file) =>
      isSupportedPageFile(file.name),
    );
    if (files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      void addPageFiles(files);
    }
  }

  async function copyFilePath(filePath: string) {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(filePath);
      window.setTimeout(() => {
        setCopiedPath((current) => (current === filePath ? "" : current));
      }, 1600);
    } catch {
      setStatus(`Copy this path manually: ${filePath}`);
    }
  }

  return (
    <div className={styles.pageItemEditor}>
      <ObjectEditor
        value={metadata}
        path={path}
        onChange={onChange}
        customLabels={customLabels}
        onLabelChange={onLabelChange}
      />

      <section
        className={styles.markdownEditor}
        id={editorTargetId([...path, "body"])}
      >
        <div className={styles.markdownEditorHeading}>
          <div>
            <h4>Page Content</h4>
            <p>
              Markdown and LaTeX are supported. Images and PDFs are saved in
              this entry&apos;s own folder and linked automatically.
            </p>
            <p className={styles.markdownFolderPath}>
              Folder:{" "}
              <code>
                {sectionId && pageSlugPattern.test(slug)
                  ? `public/page-content/${sectionId}/${slug}/`
                  : "add a valid Page Slug to create this folder"}
              </code>
            </p>
          </div>
          <div className={styles.markdownViewButtons} aria-label="Editor view">
            {(["write", "split", "preview"] as const).map((option) => (
              <button
                className={view === option ? styles.activeViewButton : ""}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                key={option}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.markdownToolbar}>
          <button
            type="button"
            disabled={busy}
            onClick={() => markdownInputRef.current?.click()}
          >
            Import Markdown
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => folderInputRef.current?.click()}
          >
            Import Folder
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => zipInputRef.current?.click()}
          >
            Import ZIP
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Add File
          </button>
          <input
            className={styles.hiddenFileInput}
            ref={markdownInputRef}
            type="file"
            accept=".md,text/markdown,image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            onChange={(event) => {
              importSelectedFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            className={styles.hiddenFileInput}
            ref={(element) => {
              folderInputRef.current = element;
              if (element) {
                element.setAttribute("webkitdirectory", "");
              }
            }}
            type="file"
            multiple
            onChange={(event) => {
              importSelectedFiles(event.target.files, true);
              event.target.value = "";
            }}
          />
          <input
            className={styles.hiddenFileInput}
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              void importZip(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <input
            className={styles.hiddenFileInput}
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,application/pdf"
            multiple
            onChange={(event) => {
              void addPageFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </div>

        {status && (
          <p className={styles.markdownStatus} role="status">
            {status}
          </p>
        )}
        {recentUploads.length > 0 && (
          <div className={styles.uploadedFilePanel}>
            <strong>
              Uploaded file paths
            </strong>
            <span>
              The Markdown link has been inserted automatically. Copy a path
              below to reuse it elsewhere in this page.
            </span>
            <ul>
              {recentUploads.map((file) => (
                <li key={file.path}>
                  <div>
                    <b>{file.name}</b>
                    <code>{file.path}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyFilePath(file.path)}
                  >
                    {copiedPath === file.path ? "Copied" : "Copy path"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={`${styles.markdownWorkspace} ${
            view === "split" ? styles.markdownWorkspaceSplit : ""
          }`}
        >
          {view !== "preview" && (
            <textarea
              className={styles.markdownTextarea}
              ref={textareaRef}
              value={body}
              aria-label="Markdown page content"
              spellCheck
              onChange={(event) => replaceBody(event.target.value)}
              readOnly={busy}
              onPaste={pasteFiles}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={dropFiles}
            />
          )}
          {view !== "write" && (
            <div className={`${styles.markdownPreview} document-body`}>
              {body.trim() ? (
                <DocumentMarkdown text={body} />
              ) : (
                <p className={styles.markdownPreviewEmpty}>
                  The preview will appear here.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CropPreview({
  sourceUrl,
  crop,
  title,
  description,
  aspectRatio,
  canvasWidth,
  canvasHeight,
  circular = false,
  onChange,
}: {
  sourceUrl: string;
  crop: CropState;
  title: string;
  description: string;
  aspectRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  circular?: boolean;
  onChange: (crop: CropState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    crop: CropState;
  } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = new window.Image();
    imageRef.current = null;

    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }

    image.onload = () => {
      imageRef.current = image;
      setImageVersion((current) => current + 1);
    };
    image.src = sourceUrl;

    return () => {
      image.onload = null;
      imageRef.current = null;
    };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !image || !context) {
      return;
    }

    const rectangle = getCropRectangle(
      image.naturalWidth,
      image.naturalHeight,
      aspectRatio,
      crop,
    );
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      rectangle.sx,
      rectangle.sy,
      rectangle.width,
      rectangle.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [aspectRatio, crop, imageVersion]);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!imageRef.current) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      crop,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;

    if (!drag || !image || !canvas || drag.pointerId !== event.pointerId) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const rectangle = getCropRectangle(
      image.naturalWidth,
      image.naturalHeight,
      aspectRatio,
      drag.crop,
    );
    const availableX = Math.max(0, image.naturalWidth - rectangle.width);
    const availableY = Math.max(0, image.naturalHeight - rectangle.height);
    const sourceX =
      rectangle.sx -
      (event.clientX - drag.clientX) * (rectangle.width / bounds.width);
    const sourceY =
      rectangle.sy -
      (event.clientY - drag.clientY) * (rectangle.height / bounds.height);

    onChange({
      ...drag.crop,
      x: availableX ? clamp(sourceX / availableX, 0, 1) : 0.5,
      y: availableY ? clamp(sourceY / availableY, 0, 1) : 0.5,
    });
  }

  function finishDragging(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className={styles.cropWorkspace}>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <canvas
        className={`${styles.cropCanvas}${
          circular ? ` ${styles.circularCropCanvas}` : ""
        }`}
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        aria-label={`Drag to crop the ${title.toLowerCase()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
      />
      <div className={styles.cropControls}>
        <label>
          <span>Zoom: {crop.zoom.toFixed(2)}×</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={crop.zoom}
            onChange={(event) =>
              onChange({ ...crop, zoom: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <span>Horizontal position</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crop.x}
            onChange={(event) =>
              onChange({ ...crop, x: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <span>Vertical position</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crop.y}
            onChange={(event) =>
              onChange({ ...crop, y: Number(event.target.value) })
            }
          />
        </label>
        <button type="button" onClick={() => onChange(defaultCrop())}>
          Reset Crop
        </button>
      </div>
    </div>
  );
}

function ProfilePhotoEditor({
  currentPath,
  currentNavPath,
  aboutSourceUrl,
  navSourceUrl,
  selectedPhoto,
  aboutCrop,
  navCrop,
  error,
  onSelect,
  onAboutCropChange,
  onNavCropChange,
  onRemove,
}: {
  currentPath: string;
  currentNavPath: string;
  aboutSourceUrl: string;
  navSourceUrl: string;
  selectedPhoto: File | null;
  aboutCrop: CropState;
  navCrop: CropState;
  error: string;
  onSelect: (file: File | null) => void;
  onAboutCropChange: (crop: CropState) => void;
  onNavCropChange: (crop: CropState) => void;
  onRemove: () => void;
}) {
  const currentPreview = currentPath ? publicPath(currentPath) : "";
  const currentNavPreview = currentNavPath
    ? publicPath(currentNavPath)
    : currentPreview;

  return (
    <section className={styles.photoEditor} aria-labelledby="profile-photo-title">
      <div className={styles.photoEditorHeading}>
        <div>
          <h3 id="profile-photo-title">Profile Photo</h3>
          <p>
            Choose one JPG, PNG, or WebP image up to 5 MB, then crop two
            independent versions: a 4:5 portrait for About Me and a square crop
            displayed as a circle in the navigation. The original file and both
            crop positions are kept, so you can return later and adjust either
            crop without uploading again.
          </p>
        </div>
        <div className={styles.photoActions}>
          <label className={styles.photoPicker}>
            <span>
              {selectedPhoto
                ? "Choose Another Photo"
                : currentPath || currentNavPath
                  ? "Replace Source Photo"
                  : "Choose Photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
            />
          </label>
          {(currentPath || currentNavPath || selectedPhoto) && (
            <button type="button" onClick={onRemove}>
              Remove Photo
            </button>
          )}
        </div>
      </div>

      {aboutSourceUrl && navSourceUrl ? (
        <div className={styles.cropPair}>
          <CropPreview
            sourceUrl={aboutSourceUrl}
            crop={aboutCrop}
            title="About Me Photo (4:5)"
            description="Drag to position the portrait beside your biography."
            aspectRatio={4 / 5}
            canvasWidth={480}
            canvasHeight={600}
            onChange={onAboutCropChange}
          />
          <CropPreview
            sourceUrl={navSourceUrl}
            crop={navCrop}
            title="Navigation Photo (1:1)"
            description="Drag separately to position the face inside the circular navigation avatar."
            aspectRatio={1}
            canvasWidth={480}
            canvasHeight={480}
            circular
            onChange={onNavCropChange}
          />
        </div>
      ) : (
        <div className={styles.savedPhotoPreviews}>
          <figure>
            <figcaption>About Me (4:5)</figcaption>
            <div
              className={`${styles.photoPreview} ${
                currentPreview ? "" : styles.emptyPhotoPreview
              }`}
            >
              {currentPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentPreview} alt="Current About Me portrait" />
              ) : (
                <span>No photo</span>
              )}
            </div>
          </figure>
          <figure>
            <figcaption>Navigation (circular)</figcaption>
            <div
              className={`${styles.photoPreview} ${styles.navPhotoPreview} ${
                currentNavPreview ? "" : styles.emptyPhotoPreview
              }`}
            >
              {currentNavPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentNavPreview} alt="Current navigation portrait" />
              ) : (
                <span>No photo</span>
              )}
            </div>
          </figure>
        </div>
      )}

      {(selectedPhoto || (aboutSourceUrl && navSourceUrl)) && (
        <p className={styles.photoStatus}>
          {selectedPhoto
            ? `Selected: ${selectedPhoto.name}. `
            : "Using the saved source photo. "}
          Adjust either crop, then select Save Changes.
        </p>
      )}
      {error && <p className={styles.photoError}>{error}</p>}
    </section>
  );
}

function sectionText(section: JsonObject, key: string) {
  return typeof section[key] === "string" ? section[key] : "";
}

function sectionBoolean(section: JsonObject, key: string) {
  return section[key] !== false;
}

function sectionNavigationChoice(
  section: JsonObject,
): "top" | "more" | "hidden" {
  const placement = sectionText(section, "navigationPlacement");
  if (
    placement === "top" ||
    placement === "more" ||
    placement === "hidden"
  ) {
    return placement;
  }
  return sectionBoolean(section, "showInNavigation") ? "top" : "hidden";
}

function uniqueSectionId(title: string, sections: JsonValue[]) {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  const existing = new Set(
    sections
      .filter(isJsonObject)
      .map((section) => sectionText(section, "id")),
  );
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function SectionStructureEditor({
  sections,
  onChange,
  onOpenSection,
}: {
  sections: JsonValue[];
  onChange: (sections: JsonValue[]) => void;
  onOpenSection: (key: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] =
    useState<Exclude<MainSectionTemplate, "about">>("education");
  const [draggingSection, setDraggingSection] = useState<number | null>(null);

  const availableTemplates = Object.entries(sectionRegistry)
    .filter(([template]) => template !== "about")
    .map(([template, definition]) => ({
      value: template as Exclude<MainSectionTemplate, "about">,
      label: definition.label,
    }));

  function updateSection(index: number, key: string, value: JsonValue) {
    const next = cloneValue(sections);
    const section = next[index];
    if (!isJsonObject(section)) {
      return;
    }
    section[key] = value;
    onChange(next);
  }

  function updateNavigationPlacement(
    index: number,
    placement: "top" | "more" | "hidden",
  ) {
    const next = cloneValue(sections);
    const section = next[index];
    if (!isJsonObject(section)) {
      return;
    }
    section.navigationPlacement = placement;
    section.showInNavigation = placement !== "hidden";
    onChange(next);
  }

  function moveSection(source: number, target: number) {
    if (
      source < 0 ||
      target < 0 ||
      source >= sections.length ||
      target >= sections.length ||
      source === target
    ) {
      return;
    }
    const next = cloneValue(sections);
    const [section] = next.splice(source, 1);
    next.splice(target, 0, section);
    onChange(next);
  }

  function removeSection(index: number) {
    const section = sections[index];
    if (!isJsonObject(section) || typeof section.dataKey === "string") {
      return;
    }
    const title = sectionText(section, "title") || "this section";
    if (!window.confirm(`Remove ${title} and all content inside it?`)) {
      return;
    }
    onChange(sections.filter((_, itemIndex) => itemIndex !== index));
  }

  function addSection() {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    const id = uniqueSectionId(title, sections);
    const content = [makeArrayItem(newTemplate, [])];
    const sourceSection = sections.find(
      (section) =>
        isJsonObject(section) &&
        sectionText(section, "template") === newTemplate,
    );
    const fieldLabelsForTemplate =
      sourceSection &&
      isJsonObject(sourceSection) &&
      isJsonObject(sourceSection.fieldLabels)
        ? cloneValue(sourceSection.fieldLabels)
        : {};
    const topNavigationCount = sections.filter(
      (section) =>
        isJsonObject(section) &&
        sectionNavigationChoice(section) === "top",
    ).length;
    const navigationPlacement =
      topNavigationCount >= 7 ? "more" : "top";
    onChange([
      ...sections,
      {
        id,
        title,
        navigationLabel: title,
        showOnHomepage: true,
        showInNavigation: true,
        navigationPlacement,
        template: newTemplate,
        fieldLabels: fieldLabelsForTemplate,
        content,
      },
    ]);
    setNewTitle("");
    window.setTimeout(() => onOpenSection(`custom:${id}`), 0);
  }

  return (
    <div className={styles.structureEditor}>
      <div className={styles.structureIntro}>
        <h3>Site section order</h3>
        <p>
          Drag the cards or use the arrow buttons to change the site order.
          “Navigation Text” controls the menu wording. Place each section in
          the top navigation, the More menu, or hide it from navigation.
          Independent Pages open as separate destinations instead of appearing
          in the homepage scroll.
        </p>
      </div>

      <div className={styles.sectionCardList}>
        {sections.map((value, index) => {
          if (!isJsonObject(value)) {
            return null;
          }
          const id = sectionText(value, "id");
          const title = sectionText(value, "title");
          const navigationLabel = sectionText(value, "navigationLabel");
          const template = sectionText(value, "template");
          const dataKey = sectionText(value, "dataKey");
          const pinned = template === "about";
          const custom = !pinned && !dataKey;
          const editKey = custom ? `custom:${id}` : dataKey;

          return (
            <article
              className={`${styles.sectionCard} ${
                draggingSection === index ? styles.draggingSectionCard : ""
              }`}
              draggable
              id={editorTargetId(["mainSections", index])}
              key={id || `section-${index}`}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
                setDraggingSection(index);
              }}
              onDragEnd={() => setDraggingSection(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source = Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(source)) {
                  moveSection(source, index);
                }
                setDraggingSection(null);
              }}
            >
              <div className={styles.sectionCardHeader}>
                <div>
                  <span className={styles.sectionOrder}>
                    Section {index + 1}
                    {pinned ? " · Homepage introduction" : ""}
                  </span>
                  <strong>{title || "Untitled Section"}</strong>
                  <small>
                    Template:{" "}
                    {template === "about"
                      ? "About"
                      : getSectionDefinition(template)?.label || template}
                  </small>
                </div>
                <div className={styles.sectionActions}>
                  <button
                    type="button"
                    onClick={() => moveSection(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${title} up`}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, index + 1)}
                    disabled={index === sections.length - 1}
                    aria-label={`Move ${title} down`}
                    title="Move down"
                  >
                    ↓
                  </button>
                  {editKey && (
                    <button
                      type="button"
                      onClick={() => onOpenSection(editKey)}
                    >
                      Edit Content
                    </button>
                  )}
                  {custom && (
                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() => removeSection(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.sectionSettings}>
                <label>
                  <span>Section Title</span>
                  <input
                    value={title}
                    onChange={(event) =>
                      updateSection(index, "title", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Navigation Text</span>
                  <input
                    value={navigationLabel}
                    onChange={(event) =>
                      updateSection(
                        index,
                        "navigationLabel",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className={styles.navigationToggle}>
                  <input
                    type="checkbox"
                    checked={sectionBoolean(value, "showOnHomepage")}
                    onChange={(event) =>
                      updateSection(
                        index,
                        "showOnHomepage",
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    {template === "pageCollection"
                      ? "Publish independent page"
                      : "Show section on homepage"}
                  </span>
                </label>
                <label>
                  <span>Navigation Placement</span>
                  <select
                    value={sectionNavigationChoice(value)}
                    onChange={(event) =>
                      updateNavigationPlacement(
                        index,
                        event.target.value as "top" | "more" | "hidden",
                      )
                    }
                  >
                    <option value="top">Top navigation</option>
                    <option value="more">More menu</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.addSectionPanel}>
        <div>
          <h3>Add a main section</h3>
          <p>
            Choose a homepage layout or Independent Pages for destinations such
            as Teaching, Courses, or Blog. Every new section receives its own
            independent content.
          </p>
        </div>
        <label>
          <span>New Section Title</span>
          <input
            value={newTitle}
            placeholder="e.g. Work Experience"
            onChange={(event) => setNewTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Use Layout From</span>
          <select
            value={newTemplate}
            onChange={(event) =>
              setNewTemplate(
                event.target.value as Exclude<MainSectionTemplate, "about">,
              )
            }
          >
            {availableTemplates.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.addButton}
          type="button"
          onClick={addSection}
          disabled={!newTitle.trim()}
        >
          ＋ Add Section
        </button>
      </div>
    </div>
  );
}

function draggedPaperPath(event: ReactDragEvent<HTMLElement>) {
  const encoded =
    event.dataTransfer.getData(paperDragType) ||
    event.dataTransfer.getData("text/plain");

  try {
    const path = JSON.parse(encoded) as unknown;
    return Array.isArray(path) ? (path as FieldPath) : null;
  } catch {
    return null;
  }
}

function ArrayEditor({
  fieldKey,
  value,
  path,
  onChange,
  onMovePaper,
  customLabels,
  onLabelChange,
  pageSectionId,
}: {
  fieldKey: string;
  value: JsonValue[];
  path: FieldPath;
  onChange: (path: FieldPath, value: JsonValue) => void;
  onMovePaper?: MovePaper;
  customLabels?: JsonObject;
  onLabelChange?: (labelKey: string, label: string) => void;
  pageSectionId?: string;
}) {
  const collapsibleItems =
    fieldKey === "papers" || fieldKey === "pageCollection";
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    () => new Set(),
  );
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const stringsOnly = value.every(
    (item) => typeof item === "string" || item === null,
  );

  function removeItem(index: number) {
    if (collapsibleItems) {
      setExpandedItems(
        (current) =>
          new Set(
            [...current]
              .filter((itemIndex) => itemIndex !== index)
              .map((itemIndex) =>
                itemIndex > index ? itemIndex - 1 : itemIndex,
              ),
          ),
      );
    }
    onChange(
      path,
      value.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) {
      return;
    }
    const next = cloneValue(value);
    [next[index], next[target]] = [next[target], next[index]];
    if (collapsibleItems) {
      setExpandedItems((current) => {
        const updated = new Set(current);
        const indexWasExpanded = current.has(index);
        const targetWasExpanded = current.has(target);
        updated.delete(index);
        updated.delete(target);
        if (indexWasExpanded) {
          updated.add(target);
        }
        if (targetWasExpanded) {
          updated.add(index);
        }
        return updated;
      });
    }
    onChange(path, next);
  }

  function addItem() {
    onChange(path, [...value, makeArrayItem(fieldKey, value)]);
  }

  function toggleItem(index: number) {
    setExpandedItems((current) => {
      const updated = new Set(current);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      return updated;
    });
  }

  function startPaperDrag(
    event: ReactDragEvent<HTMLElement>,
    index: number,
  ) {
    const sourcePath = [...path, index];
    const encodedPath = JSON.stringify(sourcePath);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(paperDragType, encodedPath);
    event.dataTransfer.setData("text/plain", encodedPath);
    setExpandedItems(new Set());
    setDraggingIndex(index);
  }

  function finishPaperDrag() {
    setDraggingIndex(null);
    setDropTargetIndex(null);
  }

  function showPaperDropTarget(
    event: ReactDragEvent<HTMLElement>,
    index: number,
  ) {
    if (!collapsibleItems || !onMovePaper) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  }

  function dropPaper(event: ReactDragEvent<HTMLElement>, index: number) {
    if (!collapsibleItems || !onMovePaper) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourcePath = draggedPaperPath(event);
    if (sourcePath) {
      setExpandedItems(new Set());
      onMovePaper(sourcePath, [...path, index]);
    }
    setDraggingIndex(null);
    setDropTargetIndex(null);
  }

  function hidePaperDropTarget(event: ReactDragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (
      !nextTarget ||
      !(nextTarget instanceof Node) ||
      !event.currentTarget.contains(nextTarget)
    ) {
      setDropTargetIndex(null);
    }
  }

  return (
    <div className={styles.arrayField}>
      <div className={styles.arrayHeading}>
        <h3>
          <EditableFieldLabel
            defaultLabel={
              fieldLabels[fieldKey] ?? sectionLabels[fieldKey] ?? fieldKey
            }
            labelKey={fieldLabelPathKey(path)}
            customLabels={customLabels}
            onLabelChange={onLabelChange}
          />
        </h3>
        <button className={styles.addButton} type="button" onClick={addItem}>
          ＋ {addLabels[fieldKey] ?? "Add Item"}
        </button>
      </div>
      {fieldKey === "papers" && (
        <p className={styles.paperDragHint}>
          Drag a paper by its handle to reorder it or move it to another
          publication status. Hidden from page — still public.
        </p>
      )}
      {fieldKey === "authors" && (
        <p className={styles.paperDragHint}>
          Mark <strong>This Is Me</strong> on your own name. That name is
          omitted from the “with …” coauthor list. If it is also marked{" "}
          <strong>Corresponding Author</strong>, ✉ appears after the paper
          title.
        </p>
      )}
      {fieldKey === "pageCollection" && (
        <p className={styles.paperDragHint}>
          Entries stay collapsed for easier editing. Each published entry opens
          its own Markdown page. Hidden from page — still public.
        </p>
      )}

      {value.length === 0 && (
        <p className={styles.emptyState}>
          No content yet. Use the button above to add an item.
        </p>
      )}

      <div className={stringsOnly ? styles.stringList : styles.cardList}>
        {value.map((item, index) => {
          const itemIsObject = isJsonObject(item);
          const shownOnHomepage =
            !itemIsObject || item.showOnHomepage !== false;
          const controls = (
            <div className={styles.itemActions}>
              {collapsibleItems && itemIsObject && (
                <button
                  className={`${styles.visibilityButton} ${
                    shownOnHomepage ? "" : styles.visibilityButtonHidden
                  }`}
                  type="button"
                  aria-pressed={shownOnHomepage}
                  title={
                    shownOnHomepage
                      ? `Hide this ${fieldKey === "papers" ? "paper" : "entry"} from the page`
                      : `Show this ${fieldKey === "papers" ? "paper" : "entry"} on the page`
                  }
                  onClick={() =>
                    onChange(
                      [...path, index, "showOnHomepage"],
                      !shownOnHomepage,
                    )
                  }
                >
                  {shownOnHomepage ? "Shown" : "Hidden"}
                </button>
              )}
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === value.length - 1}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
              <button
                className={styles.removeButton}
                type="button"
                onClick={() => removeItem(index)}
              >
                Remove
              </button>
            </div>
          );

          if (typeof item === "string" || item === null) {
            const stringValue = item ?? "";
            const multiline =
              longTextFields.has(fieldKey) || stringValue.length > 90;
            return (
              <div
                className={styles.stringRow}
                id={editorTargetId([...path, index])}
                key={`${fieldKey}-${index}`}
              >
                {multiline ? (
                  <textarea
                    rows={Math.min(
                      7,
                      Math.max(2, Math.ceil(stringValue.length / 75)),
                    )}
                    value={stringValue}
                    aria-label={`${fieldLabels[fieldKey] ?? fieldKey} ${index + 1}`}
                    onChange={(event) =>
                      onChange([...path, index], event.target.value)
                    }
                  />
                ) : (
                  <input
                    value={stringValue}
                    aria-label={`${fieldLabels[fieldKey] ?? fieldKey} ${index + 1}`}
                    onChange={(event) =>
                      onChange([...path, index], event.target.value)
                    }
                  />
                )}
                {controls}
              </div>
            );
          }

          if (!isJsonObject(item)) {
            return null;
          }

          const expanded = !collapsibleItems || expandedItems.has(index);
          const itemTitle = titleForItem(item, index);

          return (
            <article
              className={`${styles.itemCard} ${
                collapsibleItems && !expanded ? styles.collapsedItemCard : ""
              } ${draggingIndex === index ? styles.draggingPaper : ""} ${
                dropTargetIndex === index ? styles.paperDropTarget : ""
              }`}
              id={editorTargetId([...path, index])}
              key={`${fieldKey}-${index}`}
              onDragOver={(event) => showPaperDropTarget(event, index)}
              onDragLeave={hidePaperDropTarget}
              onDrop={(event) => dropPaper(event, index)}
            >
              <div
                className={`${styles.itemHeader} ${
                  collapsibleItems && !expanded
                    ? styles.collapsedItemHeader
                    : ""
                }`}
              >
                {collapsibleItems ? (
                  <button
                    className={styles.itemToggle}
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${itemTitle}`}
                    onClick={() => toggleItem(index)}
                  >
                    <span className={styles.itemToggleTitle}>{itemTitle}</span>
                    <span className={styles.itemToggleState} aria-hidden="true">
                      {expanded ? "Collapse ↑" : "Expand ↓"}
                    </span>
                  </button>
                ) : (
                  <h4>{itemTitle}</h4>
                )}
                <div className={styles.itemControlCluster}>
                  {collapsibleItems && onMovePaper && (
                    <button
                      className={styles.dragHandle}
                      type="button"
                      draggable
                      aria-label={`Drag ${itemTitle}`}
                      title="Drag to reorder or move to another publication status"
                      onDragStart={(event) => startPaperDrag(event, index)}
                      onDragEnd={finishPaperDrag}
                    >
                      ⋮⋮ Drag
                    </button>
                  )}
                  {controls}
                </div>
              </div>
              {expanded && (
                fieldKey === "pageCollection" ? (
                  <PageCollectionItemEditor
                    item={item}
                    path={[...path, index]}
                    sectionId={pageSectionId ?? ""}
                    onChange={onChange}
                    customLabels={customLabels}
                    onLabelChange={onLabelChange}
                  />
                ) : (
                  <ObjectEditor
                    value={item}
                    path={[...path, index]}
                    onChange={onChange}
                    onMovePaper={onMovePaper}
                    customLabels={customLabels}
                    onLabelChange={onLabelChange}
                  />
                )
              )}
            </article>
          );
        })}
        {collapsibleItems && onMovePaper && (
          <div
            className={`${styles.paperDropZone} ${
              dropTargetIndex === value.length
                ? styles.paperDropZoneActive
                : ""
            }`}
            onDragOver={(event) => showPaperDropTarget(event, value.length)}
            onDragLeave={hidePaperDropTarget}
            onDrop={(event) => dropPaper(event, value.length)}
          >
            Drop here to place a paper at the end of this section
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectEditor({
  value,
  path,
  onChange,
  onMovePaper,
  customLabels,
  onLabelChange,
}: {
  value: JsonObject;
  path: FieldPath;
  onChange: (path: FieldPath, value: JsonValue) => void;
  onMovePaper?: MovePaper;
  customLabels?: JsonObject;
  onLabelChange?: (labelKey: string, label: string) => void;
}) {
  const isAuthorEditor =
    typeof value.name === "string" &&
    typeof value.self === "boolean" &&
    typeof value.corresponding === "boolean";

  return (
    <div
      className={`${styles.fieldGrid} ${
        isAuthorEditor ? styles.authorFieldGrid : ""
      }`}
    >
      {Object.entries(value).map(([key, fieldValue]) => {
        if (
          key === "id" ||
          key === "showOnHomepage" ||
          (path[0] === "profile" &&
            (key === "photoPath" ||
              key === "navPhotoPath" ||
              key === "originalPhotoPath" ||
              key === "photoCrops"))
        ) {
          return null;
        }

        if (Array.isArray(fieldValue)) {
          return (
            <div className={styles.fullWidth} key={key}>
              <ArrayEditor
                fieldKey={key}
                value={fieldValue}
                path={[...path, key]}
                onChange={onChange}
                onMovePaper={onMovePaper}
                customLabels={customLabels}
                onLabelChange={onLabelChange}
              />
            </div>
          );
        }

        if (isJsonObject(fieldValue)) {
          return (
            <fieldset className={styles.nestedObject} key={key}>
              <legend>
                <EditableFieldLabel
                  defaultLabel={fieldLabels[key] ?? key}
                  labelKey={fieldLabelPathKey([...path, key])}
                  customLabels={customLabels}
                  onLabelChange={onLabelChange}
                />
              </legend>
              <ObjectEditor
                value={fieldValue}
                path={[...path, key]}
                onChange={onChange}
                onMovePaper={onMovePaper}
                customLabels={customLabels}
                onLabelChange={onLabelChange}
              />
            </fieldset>
          );
        }

        return (
          <EditorField
            fieldKey={key}
            value={fieldValue}
            path={[...path, key]}
            onChange={onChange}
            customLabels={customLabels}
            onLabelChange={onLabelChange}
            key={key}
          />
        );
      })}
    </div>
  );
}

export default function ContentEditor() {
  const initialContent = useMemo(
    () => ensureMainSections(siteContent as unknown as JsonObject),
    [],
  );
  const [activeSection, setActiveSection] = useState("siteSettings");
  const [settingsPanel, setSettingsPanel] = useState<
    "sections" | "profile" | "analytics"
  >("sections");
  const [draft, setDraft] = useState<JsonObject>(() =>
    cloneValue(initialContent),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localEditor, setLocalEditor] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Loading content…");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [aboutPhotoCrop, setAboutPhotoCrop] = useState<CropState>(() =>
    savedCrop(initialContent, "about"),
  );
  const [navPhotoCrop, setNavPhotoCrop] = useState<CropState>(() =>
    savedCrop(initialContent, "nav"),
  );
  const [photoCropDirty, setPhotoCropDirty] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    () => validateSiteContent(initialContent),
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const bibtexInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [bibtexTargetGroup, setBibtexTargetGroup] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );

  function applyDraftChange(
    updater: (current: JsonObject) => JsonObject,
    nextMessage = "Unsaved changes",
  ) {
    const next = updater(draft);
    const previousCvPath = isJsonObject(draft.profile)
      ? String(draft.profile.cvPath ?? "")
      : "";
    const nextCvPath = isJsonObject(next.profile)
      ? String(next.profile.cvPath ?? "")
      : "";
    const nextIssues = validateSiteContent(next);
    if (previousCvPath === nextCvPath) {
      validationIssues
        .filter(
          (issue) =>
            issue.path === "profile.cvPath" &&
            /could not be (?:found|checked)/i.test(issue.message),
        )
        .forEach((issue) => {
          if (
            !nextIssues.some(
              (candidate) =>
                candidate.path === issue.path &&
                candidate.message === issue.message,
            )
          ) {
            nextIssues.push(issue);
          }
        });
    }
    setDraft(next);
    setValidationIssues(nextIssues);
    setDirty(true);
    setMessage(nextMessage);
  }

  async function loadContent(confirmDiscard = false) {
    if (
      confirmDiscard &&
      dirty &&
      !window.confirm("Discard unsaved changes and reload the content file?")
    ) {
      return;
    }

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("The local content file could not be read.");
      }
      const content = ensureMainSections(
        (await response.json()) as JsonObject,
      );
      setDraft(content);
      setValidationIssues(await collectValidationIssues(content));
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setPhotoError("");
      setAboutPhotoCrop(savedCrop(content, "about"));
      setNavPhotoCrop(savedCrop(content, "nav"));
      setPhotoCropDirty(false);
      setDirty(false);
      setMessage("Latest content loaded");
    } catch {
      const bundledContent = ensureMainSections(cloneValue(initialContent));
      setDraft(bundledContent);
      setValidationIssues(await collectValidationIssues(bundledContent));
      setAboutPhotoCrop(savedCrop(bundledContent, "about"));
      setNavPhotoCrop(savedCrop(bundledContent, "nav"));
      setPhotoCropDirty(false);
      setMessage("Loaded the content bundled with this page");
    }
  }

  useEffect(() => {
    async function initializeEditor() {
      await Promise.resolve();
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(
        window.location.hostname,
      );
      setLocalEditor(isLocal);
      if (isLocal) {
        await loadContent();
      } else {
        setMessage("Saving is available only from a local preview address");
      }
    }
    void initializeEditor();
    // The first load intentionally runs only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void collectValidationIssues(draft).then((issues) => {
        if (!cancelled) {
          setValidationIssues(issues);
        }
      });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      previewFrameRef.current?.contentWindow?.postMessage(
        { type: "scholarcanvas:preview", content: draft },
        window.location.origin,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft, previewOpen]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    function handlePreviewMessage(event: MessageEvent) {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "scholarcanvas:preview-ready"
      ) {
        previewFrameRef.current?.contentWindow?.postMessage(
          { type: "scholarcanvas:preview", content: draft },
          window.location.origin,
        );
      }
    }

    function closePreviewWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    window.addEventListener("message", handlePreviewMessage);
    window.addEventListener("keydown", closePreviewWithEscape);
    return () => {
      window.removeEventListener("message", handlePreviewMessage);
      window.removeEventListener("keydown", closePreviewWithEscape);
    };
  }, [draft, previewOpen]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (localEditor && dirty && !saving) {
          void saveContent();
        }
      }
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
    // saveContent uses the current render's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dirty,
    localEditor,
    saving,
    draft,
    selectedPhoto,
    aboutPhotoCrop,
    navPhotoCrop,
    photoCropDirty,
  ]);

  function changeValue(path: FieldPath, value: JsonValue) {
    applyDraftChange((current) => updatePath(current, path, value));
  }

  function movePublicationPaper(
    sourcePath: FieldPath,
    targetPath: FieldPath,
  ) {
    const validPath = (path: FieldPath) =>
      path.length === 4 &&
      path[0] === "publicationGroups" &&
      typeof path[1] === "number" &&
      path[2] === "papers" &&
      typeof path[3] === "number";

    if (!validPath(sourcePath) || !validPath(targetPath)) {
      return;
    }

    const sourceGroupIndex = sourcePath[1] as number;
    const sourcePaperIndex = sourcePath[3] as number;
    const targetGroupIndex = targetPath[1] as number;
    const requestedTargetIndex = targetPath[3] as number;

    applyDraftChange((current) => {
      if (!Array.isArray(current.publicationGroups)) {
        return current;
      }

      const groups = cloneValue(current.publicationGroups);
      const sourceGroup = groups[sourceGroupIndex];
      const targetGroup = groups[targetGroupIndex];

      if (!isJsonObject(sourceGroup) || !isJsonObject(targetGroup)) {
        return current;
      }
      if (
        !Array.isArray(sourceGroup.papers) ||
        !Array.isArray(targetGroup.papers) ||
        sourcePaperIndex < 0 ||
        sourcePaperIndex >= sourceGroup.papers.length
      ) {
        return current;
      }

      let targetIndex = requestedTargetIndex;
      if (
        sourceGroupIndex === targetGroupIndex &&
        sourcePaperIndex < targetIndex
      ) {
        targetIndex -= 1;
      }
      if (
        sourceGroupIndex === targetGroupIndex &&
        sourcePaperIndex === targetIndex
      ) {
        return current;
      }

      const [paper] = sourceGroup.papers.splice(sourcePaperIndex, 1);
      if (paper === undefined) {
        return current;
      }
      targetIndex = clamp(targetIndex, 0, targetGroup.papers.length);
      targetGroup.papers.splice(targetIndex, 0, paper);

      return updatePath(current, ["publicationGroups"], groups);
    }, "Paper moved — save changes to apply the new status and order");
  }

  function changePhotoCrop(kind: "about" | "nav", crop: CropState) {
    if (kind === "about") {
      setAboutPhotoCrop(crop);
    } else {
      setNavPhotoCrop(crop);
    }
    setPhotoCropDirty(true);
    setDirty(true);
    setMessage("Photo crop changed — save changes to apply it");
  }

  function selectPhoto(file: File | null) {
    setPhotoError("");

    if (!file) {
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setAboutPhotoCrop(savedCrop(draft, "about"));
      setNavPhotoCrop(savedCrop(draft, "nav"));
      setPhotoCropDirty(false);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setAboutPhotoCrop(savedCrop(draft, "about"));
      setNavPhotoCrop(savedCrop(draft, "nav"));
      setPhotoCropDirty(false);
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > maximumPhotoSize) {
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setAboutPhotoCrop(savedCrop(draft, "about"));
      setNavPhotoCrop(savedCrop(draft, "nav"));
      setPhotoCropDirty(false);
      setPhotoError("The selected image is larger than 5 MB.");
      return;
    }

    setSelectedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setAboutPhotoCrop(defaultCrop());
    setNavPhotoCrop(defaultCrop());
    setPhotoCropDirty(true);
    setDirty(true);
    setMessage("Photo selected — save changes to apply it");
  }

  function removePhoto() {
    setSelectedPhoto(null);
    setPhotoPreviewUrl("");
    setPhotoError("");
    setAboutPhotoCrop(defaultCrop());
    setNavPhotoCrop(defaultCrop());
    setPhotoCropDirty(false);
    applyDraftChange((current) => {
      const withoutAbout = updatePath(current, ["profile", "photoPath"], "");
      const withoutNav = updatePath(
        withoutAbout,
        ["profile", "navPhotoPath"],
        "",
      );
      const withoutOriginal = updatePath(
        withoutNav,
        ["profile", "originalPhotoPath"],
        "",
      );
      return updatePath(withoutOriginal, ["profile", "photoCrops"], {
        about: defaultCrop(),
        nav: defaultCrop(),
      });
    });
  }

  async function collectValidationIssues(content: JsonObject) {
    const issues = validateSiteContent(content);
    const profile = isJsonObject(content.profile) ? content.profile : null;
    const cvPath = typeof profile?.cvPath === "string" ? profile.cvPath.trim() : "";

    if (cvPath.startsWith("/")) {
      try {
        const response = await fetch(publicPath(cvPath), {
          method: "HEAD",
          cache: "no-store",
        });
        if (!response.ok) {
          issues.push({
            level: "warning",
            path: "profile.cvPath",
            message: `The CV file could not be found at ${cvPath}.`,
          });
        }
      } catch {
        issues.push({
          level: "warning",
          path: "profile.cvPath",
          message: `The CV file could not be checked at ${cvPath}.`,
        });
      }
    }

    return issues;
  }

  async function importBackup(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as JsonValue;
      if (!isJsonObject(parsed) || !isJsonObject(parsed.profile)) {
        throw new Error("This file is not a valid homepage content backup.");
      }
      const imported = ensureMainSections(parsed);
      const issues = validateSiteContent(imported);
      applyDraftChange(() => imported, `Imported ${file.name} — review and save`);
      setValidationIssues(issues);
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setPhotoError("");
      setAboutPhotoCrop(savedCrop(imported, "about"));
      setNavPhotoCrop(savedCrop(imported, "nav"));
      setPhotoCropDirty(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The backup could not be imported.",
      );
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function importBibtexFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const entries = parseBibtexEntries(await file.text());
      if (entries.length === 0) {
        throw new Error("No BibTeX entries were found in this file.");
      }

      const importedPapers = entries.map(publicationFromBibtex);
      const selectedGroup =
        Array.isArray(draft.publicationGroups) &&
        isJsonObject(draft.publicationGroups[bibtexTargetGroup])
          ? draft.publicationGroups[bibtexTargetGroup]
          : null;
      if (!selectedGroup) {
        throw new Error(
          "Choose a valid publication status before importing this BibTeX file.",
        );
      }
      const targetTitle =
        typeof selectedGroup.title === "string" &&
        selectedGroup.title.trim()
          ? selectedGroup.title
          : "the selected publication group";
      applyDraftChange(
        (current) => {
          if (!Array.isArray(current.publicationGroups)) {
            return current;
          }
          const groups = cloneValue(current.publicationGroups);
          const targetGroup = groups[bibtexTargetGroup];
          if (!isJsonObject(targetGroup)) {
            return current;
          }
          const papers = Array.isArray(targetGroup.papers)
            ? targetGroup.papers
            : [];
          targetGroup.papers = [...papers, ...importedPapers];
          return updatePath(current, ["publicationGroups"], groups);
        },
        `Imported ${entries.length} BibTeX entr${
          entries.length === 1 ? "y" : "ies"
        } into ${targetTitle} — review author markers, then save`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The BibTeX file could not be imported.",
      );
    } finally {
      if (bibtexInputRef.current) {
        bibtexInputRef.current.value = "";
      }
    }
  }

  async function saveContent() {
    if (!localEditor || saving) {
      return;
    }

    const migratedDraft = ensureMainSections(draft);
    const issues = await collectValidationIssues(migratedDraft);
    setValidationIssues(issues);
    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      setMessage(`Fix ${errors.length} validation error${errors.length === 1 ? "" : "s"} before saving`);
      return;
    }
    const warnings = issues.filter((issue) => issue.level === "warning");
    if (
      warnings.length > 0 &&
      !window.confirm(
        `The editor found ${warnings.length} warning${
          warnings.length === 1 ? "" : "s"
        }:\n\n${warnings
          .map(
            (issue) =>
              `• ${validationLocation(issue, migratedDraft).label}\n  ${issue.message}`,
          )
          .join("\n")}\n\nSave anyway?`,
      )
    ) {
      setMessage("Save paused — review the validation warnings");
      return;
    }

    setSaving(true);
    setMessage("Saving…");

    try {
      let contentToSave = migratedDraft;
      let resetLegacyCropsAfterSave = false;

      if (selectedPhoto || photoCropDirty) {
        setMessage("Creating cropped profile photos…");
        const profile = isJsonObject(migratedDraft.profile)
          ? migratedDraft.profile
          : null;
        const savedOriginalPath =
          typeof profile?.originalPhotoPath === "string"
            ? profile.originalPhotoPath
            : "";
        const savedAboutPath =
          typeof profile?.photoPath === "string" ? profile.photoPath : "";
        const savedNavPath =
          typeof profile?.navPhotoPath === "string"
            ? profile.navPhotoPath
            : savedAboutPath;
        const aboutSource = selectedPhoto
          ? selectedPhoto
          : publicPath(savedOriginalPath || savedAboutPath);
        const navSource = selectedPhoto
          ? selectedPhoto
          : publicPath(savedOriginalPath || savedNavPath);

        if (!aboutSource || !navSource) {
          throw new Error("Choose a source photo before adjusting the crop.");
        }

        const aboutImage = await loadPhoto(aboutSource);
        const navImage =
          navSource === aboutSource ? aboutImage : await loadPhoto(navSource);
        const aboutPhoto = await createCroppedPhoto(
          aboutImage,
          aboutPhotoCrop,
          800,
          1000,
        );
        const navPhoto = await createCroppedPhoto(
          navImage,
          navPhotoCrop,
          512,
          512,
        );
        const uploads = [
          uploadPhoto(aboutPhoto, "about"),
          uploadPhoto(navPhoto, "nav"),
        ];
        if (selectedPhoto) {
          uploads.push(uploadPhoto(selectedPhoto, "original"));
        }
        const [croppedPhotoPath, croppedNavPhotoPath, uploadedOriginalPath] =
          await Promise.all(uploads);

        let contentWithPhotos = updatePath(
          migratedDraft,
          ["profile", "photoPath"],
          croppedPhotoPath,
        );
        contentWithPhotos = updatePath(
          contentWithPhotos,
          ["profile", "navPhotoPath"],
          croppedNavPhotoPath,
        );
        if (uploadedOriginalPath) {
          contentWithPhotos = updatePath(
            contentWithPhotos,
            ["profile", "originalPhotoPath"],
            uploadedOriginalPath,
          );
        }
        resetLegacyCropsAfterSave = !selectedPhoto && !savedOriginalPath;
        const cropsToSave = resetLegacyCropsAfterSave
          ? { about: defaultCrop(), nav: defaultCrop() }
          : { about: aboutPhotoCrop, nav: navPhotoCrop };
        contentToSave = updatePath(
          contentWithPhotos,
          ["profile", "photoCrops"],
          cropsToSave,
        );
        setDraft(contentToSave);
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentToSave),
      });
      const result = (await response.json()) as {
        saved?: boolean;
        error?: string;
        removedImages?: string[];
        removedPageFiles?: number;
        removedPageAssets?: number;
      };

      if (!response.ok || !result.saved) {
        throw new Error(result.error ?? "The changes could not be saved.");
      }

      setDirty(false);
      setDraft(contentToSave);
      setSelectedPhoto(null);
      setPhotoPreviewUrl("");
      setPhotoError("");
      setPhotoCropDirty(false);
      if (resetLegacyCropsAfterSave) {
        setAboutPhotoCrop(defaultCrop());
        setNavPhotoCrop(defaultCrop());
      }
      setValidationIssues(issues);
      const removedCount =
        (result.removedImages?.length ?? 0) +
        (result.removedPageFiles ?? 0) +
        (result.removedPageAssets ?? 0);
      setMessage(
        removedCount
          ? `Saved — removed ${removedCount} unused generated file${
              removedCount === 1 ? "" : "s"
            }`
          : "Saved — the homepage will update automatically",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The changes could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadBackup() {
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "site-content-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const configuredSections = Array.isArray(draft.mainSections)
    ? draft.mainSections
    : [];
  const editorSections = [
    {
      key: "siteSettings",
      label: sectionLabels.siteSettings,
      description: sectionDescriptions.siteSettings,
      showInSidebar: true,
    },
    ...configuredSections
      .filter(isJsonObject)
      .filter((section) => sectionText(section, "template") !== "about")
      .map((section) => {
        const id = sectionText(section, "id");
        const title = sectionText(section, "title") || "Untitled Section";
        const dataKey = sectionText(section, "dataKey");
        const template = sectionText(section, "template");
        return {
          key: dataKey || `custom:${id}`,
          label: title,
          showInSidebar: sectionBoolean(section, "showOnHomepage"),
          description:
            getSectionDefinition(template)?.description ||
            `Edit the content shown in ${title}.`,
        };
      }),
  ].filter(
    (entry, index, entries) =>
      entry.key && entries.findIndex((item) => item.key === entry.key) === index,
  );
  const customSectionId = activeSection.startsWith("custom:")
    ? activeSection.slice("custom:".length)
    : "";
  const customSectionIndex = customSectionId
    ? configuredSections.findIndex(
        (section) =>
          isJsonObject(section) &&
          sectionText(section, "id") === customSectionId,
      )
    : -1;
  const customSection =
    customSectionIndex >= 0 &&
    isJsonObject(configuredSections[customSectionIndex])
      ? configuredSections[customSectionIndex]
      : null;
  const customTemplate = customSection
    ? sectionText(customSection, "template")
    : "";
  const sectionValue = customSection
    ? customSection.content
    : draft[activeSection];
  const sectionFieldKey = customSection ? customTemplate : activeSection;
  const sectionPath: FieldPath = customSection
    ? ["mainSections", customSectionIndex, "content"]
    : [activeSection];
  const activeMainSectionIndex =
    customSectionIndex >= 0
      ? customSectionIndex
      : configuredSections.findIndex(
          (section) =>
            isJsonObject(section) &&
            sectionText(section, "dataKey") === activeSection,
        );
  const activeMainSection =
    activeMainSectionIndex >= 0 &&
    isJsonObject(configuredSections[activeMainSectionIndex])
      ? configuredSections[activeMainSectionIndex]
      : null;
  const activeFieldLabels =
    activeMainSection && isJsonObject(activeMainSection.fieldLabels)
      ? activeMainSection.fieldLabels
      : {};

  function changeActiveFieldLabel(labelKey: string, label: string) {
    if (activeMainSectionIndex < 0) {
      return;
    }
    changeValue(
      ["mainSections", activeMainSectionIndex, "fieldLabels"],
      {
        ...activeFieldLabels,
        [labelKey]: label,
      },
    );
  }

  const activeEditorSection =
    editorSections.find((entry) => entry.key === activeSection) ??
    editorSections[0];
  const profileValue = isJsonObject(draft.profile) ? draft.profile : null;
  const contactsValue = Array.isArray(draft.contacts) ? draft.contacts : [];
  const analyticsValue = isJsonObject(draft.analytics)
    ? draft.analytics
    : null;
  const currentPhotoPath =
    typeof profileValue?.photoPath === "string" ? profileValue.photoPath : "";
  const currentNavPhotoPath =
    typeof profileValue?.navPhotoPath === "string"
      ? profileValue.navPhotoPath
      : currentPhotoPath;
  const currentOriginalPhotoPath =
    typeof profileValue?.originalPhotoPath === "string"
      ? profileValue.originalPhotoPath
      : "";
  const savedSourcePhotoPath = currentOriginalPhotoPath || currentPhotoPath;
  const aboutPhotoSourceUrl =
    photoPreviewUrl ||
    (savedSourcePhotoPath ? publicPath(savedSourcePhotoPath) : "");
  const navPhotoSourceUrl =
    photoPreviewUrl ||
    (currentOriginalPhotoPath
      ? publicPath(currentOriginalPhotoPath)
      : currentNavPhotoPath
        ? publicPath(currentNavPhotoPath)
        : aboutPhotoSourceUrl);

  function openValidationIssue(issue: ValidationIssue) {
    const location = validationLocation(issue, draft);
    setActiveSection(location.sectionKey);
    if (location.settingsPanel) {
      setSettingsPanel(location.settingsPanel);
    }

    window.setTimeout(() => {
      void (async () => {
        const pause = () =>
          new Promise<void>((resolve) =>
            window.setTimeout(resolve, 40),
          );
        let lastItem: HTMLElement | null = null;

        for (const itemPath of location.itemPaths) {
          let item = document.getElementById(editorTargetId(itemPath));
          if (!item) {
            await pause();
            item = document.getElementById(editorTargetId(itemPath));
          }
          if (!item) {
            continue;
          }
          lastItem = item;
          const toggle = item.querySelector<HTMLButtonElement>(
            'button[aria-expanded="false"]',
          );
          if (toggle) {
            toggle.click();
            await pause();
          }
        }

        const target =
          document.getElementById(editorTargetId(location.targetPath)) ??
          lastItem;
        if (!target) {
          return;
        }
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        target.classList.add(styles.validationTargetActive);
        const focusTarget = target.matches("input, textarea, select, button")
          ? target
          : target.querySelector<HTMLElement>(
              "input, textarea, select, button",
            );
        focusTarget?.focus({ preventScroll: true });
        window.setTimeout(
          () => target.classList.remove(styles.validationTargetActive),
          1800,
        );
      })();
    }, 0);
  }

  return (
    <main className={styles.editorShell}>
      <header className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>Local content editor</p>
          <h1>Homepage Content Editor</h1>
          <p>
            Edit the fields below and select Save Changes. Your homepage content
            is stored in the project files; no database is required. Text fields
            support Markdown and LaTeX, including **bold**, *italic*, links,
            $...$, and $$...$$. Content format version{" "}
            {currentContentSchemaVersion}.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.previewLink} href={publicPath("/")} target="_blank">
            Open Homepage ↗
          </a>
          <button type="button" onClick={() => setPreviewOpen(true)}>
            Live Preview
          </button>
          <label className={styles.importButton}>
            Import Backup
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) =>
                void importBackup(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <button type="button" onClick={downloadBackup}>
            Export Backup
          </button>
          <button
            className={styles.saveButton}
            type="button"
            onClick={() => void saveContent()}
            disabled={!localEditor || !dirty || saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </header>

      {localEditor === false && (
        <div className={styles.warning}>
          To prevent the public site from exposing a writable editor, saving is
          enabled only on localhost or 127.0.0.1.
        </div>
      )}

      {validationIssues.length > 0 && (
        <section className={styles.validationPanel} aria-live="polite">
          <strong>
            Content check · {validationIssues.length} unresolved
          </strong>
          <ul>
            {validationIssues.map((issue, index) => {
              const location = validationLocation(issue, draft);
              return (
                <li
                  className={
                    issue.level === "error"
                      ? styles.validationError
                      : styles.validationWarning
                  }
                  key={`${issue.path}-${index}`}
                >
                  <span>
                    {issue.level === "error" ? "Error" : "Warning"}
                  </span>
                  <div className={styles.validationIssueDetail}>
                    <button
                      type="button"
                      title={issue.path}
                      onClick={() => openValidationIssue(issue)}
                    >
                      <b>{location.label}</b>
                      <span>Open →</span>
                    </button>
                    <p>{issue.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className={styles.editorLayout}>
        <aside className={styles.sidebar}>
          <nav aria-label="Content sections">
            {editorSections
              .filter((entry) => entry.showInSidebar)
              .map((entry) => (
              <button
                className={
                  activeSection === entry.key ? styles.activeTab : ""
                }
                type="button"
                onClick={() => setActiveSection(entry.key)}
                key={entry.key}
              >
                {entry.label}
              </button>
              ))}
          </nav>
          <div className={styles.saveStatus} aria-live="polite">
            <span className={dirty ? styles.unsavedDot : styles.savedDot} />
            {message}
          </div>
          <button
            className={styles.reloadButton}
            type="button"
            onClick={() => void loadContent(true)}
            disabled={!localEditor}
          >
            Reload File
          </button>
        </aside>

        <section className={styles.editorPanel}>
          <div className={styles.panelHeading}>
            <p>{activeEditorSection.label}</p>
            <h2>{activeEditorSection.description}</h2>
          </div>

          {activeSection === "siteSettings" ? (
            <div className={styles.siteSettings}>
              <nav
                className={styles.settingsTabs}
                aria-label="Site settings"
              >
                <button
                  className={
                    settingsPanel === "sections"
                      ? styles.activeSettingsTab
                      : ""
                  }
                  type="button"
                  onClick={() => setSettingsPanel("sections")}
                >
                  Main Sections
                </button>
                <button
                  className={
                    settingsPanel === "profile"
                      ? styles.activeSettingsTab
                      : ""
                  }
                  type="button"
                  onClick={() => setSettingsPanel("profile")}
                >
                  Profile & Contact
                </button>
                <button
                  className={
                    settingsPanel === "analytics"
                      ? styles.activeSettingsTab
                      : ""
                  }
                  type="button"
                  onClick={() => setSettingsPanel("analytics")}
                >
                  Analytics
                </button>
              </nav>

              {settingsPanel === "sections" && (
                <SectionStructureEditor
                  sections={configuredSections}
                  onChange={(sections) =>
                    changeValue(["mainSections"], sections)
                  }
                  onOpenSection={setActiveSection}
                />
              )}

              {settingsPanel === "profile" && profileValue && (
                <div className={styles.settingsStack}>
                  <section className={styles.settingsGroup}>
                    <div className={styles.settingsGroupHeading}>
                      <strong>Profile</strong>
                      <span>
                        Identity, alternate names, biography, photo, CV, and
                        search information.
                      </span>
                    </div>
                    <ProfilePhotoEditor
                      currentPath={currentPhotoPath}
                      currentNavPath={currentNavPhotoPath}
                      aboutSourceUrl={aboutPhotoSourceUrl}
                      navSourceUrl={navPhotoSourceUrl}
                      selectedPhoto={selectedPhoto}
                      aboutCrop={aboutPhotoCrop}
                      navCrop={navPhotoCrop}
                      error={photoError}
                      onSelect={selectPhoto}
                      onAboutCropChange={(crop) =>
                        changePhotoCrop("about", crop)
                      }
                      onNavCropChange={(crop) =>
                        changePhotoCrop("nav", crop)
                      }
                      onRemove={removePhoto}
                    />
                    <ObjectEditor
                      value={profileValue}
                      path={["profile"]}
                      onChange={changeValue}
                    />
                  </section>

                  <section className={styles.settingsGroup}>
                    <div className={styles.settingsGroupHeading}>
                      <strong>Contact Links</strong>
                      <span>
                        Email, Google Scholar, SSRN, GitHub, ORCID, and other
                        profile links.
                      </span>
                    </div>
                    <ArrayEditor
                      fieldKey="contacts"
                      value={contactsValue}
                      path={["contacts"]}
                      onChange={changeValue}
                    />
                  </section>
                </div>
              )}

              {settingsPanel === "analytics" && analyticsValue && (
                <div className={styles.settingsGroup}>
                  <div className={styles.analyticsNotice}>
                    <strong>
                      Use the values from Umami&apos;s tracking code.
                    </strong>
                    <p>
                      The Website ID is safe to publish with the site. Do not
                      paste an Umami password, API key, or access token here.
                      The tracking script loads only when analytics is enabled
                      and both fields are complete.
                    </p>
                  </div>
                  <ObjectEditor
                    value={analyticsValue}
                    path={["analytics"]}
                    onChange={changeValue}
                  />
                </div>
              )}
            </div>
          ) : Array.isArray(sectionValue) ? (
            <>
              {activeSection === "publicationGroups" && (
                <section className={styles.bibtexImporter}>
                  <div>
                    <strong>Bulk import BibTeX</strong>
                    <p>
                      Choose a destination, then import a .bib file. Every entry
                      becomes a collapsed paper that you can review before saving.
                    </p>
                  </div>
                  <label>
                    Publication status
                    <select
                      value={bibtexTargetGroup}
                      onChange={(event) =>
                        setBibtexTargetGroup(Number(event.target.value))
                      }
                    >
                      {sectionValue.map((group, index) => (
                        <option value={index} key={index}>
                          {isJsonObject(group) &&
                          typeof group.title === "string" &&
                          group.title.trim()
                            ? group.title
                            : `Group ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.importButton}>
                    Import .bib file
                    <input
                      ref={bibtexInputRef}
                      type="file"
                      accept=".bib,application/x-bibtex,text/plain"
                      disabled={sectionValue.length === 0}
                      onChange={(event) =>
                        void importBibtexFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </section>
              )}
              <ArrayEditor
                fieldKey={sectionFieldKey}
                value={sectionValue}
                path={sectionPath}
                onChange={changeValue}
                onMovePaper={
                  activeSection === "publicationGroups"
                    ? movePublicationPaper
                    : undefined
                }
                customLabels={activeFieldLabels}
                pageSectionId={
                  customTemplate === "pageCollection"
                    ? customSectionId
                    : undefined
                }
                onLabelChange={
                  activeMainSectionIndex >= 0
                    ? changeActiveFieldLabel
                    : undefined
                }
              />
            </>
          ) : isJsonObject(sectionValue) ? (
            <ObjectEditor
              value={sectionValue}
              path={[activeSection]}
              onChange={changeValue}
              customLabels={activeFieldLabels}
              onLabelChange={
                activeMainSectionIndex >= 0
                  ? changeActiveFieldLabel
                  : undefined
              }
            />
          ) : (
            <p>This section has no editable content.</p>
          )}
        </section>
      </div>
      {previewOpen && (
        <div
          className={styles.previewBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewOpen(false);
            }
          }}
        >
          <section
            className={styles.previewDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Live homepage preview"
          >
            <header className={styles.previewToolbar}>
              <div>
                <strong>Live Preview</strong>
                <span>Updates as you edit; saving is not required.</span>
              </div>
              <div className={styles.previewDeviceControls}>
                <button
                  className={
                    previewDevice === "desktop"
                      ? styles.activePreviewDevice
                      : ""
                  }
                  type="button"
                  aria-pressed={previewDevice === "desktop"}
                  onClick={() => setPreviewDevice("desktop")}
                >
                  Desktop
                </button>
                <button
                  className={
                    previewDevice === "mobile"
                      ? styles.activePreviewDevice
                      : ""
                  }
                  type="button"
                  aria-pressed={previewDevice === "mobile"}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  Mobile
                </button>
                <button type="button" onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </header>
            <div
              className={`${styles.previewViewport} ${
                previewDevice === "mobile"
                  ? styles.previewViewportMobile
                  : styles.previewViewportDesktop
              }`}
            >
              <iframe
                ref={previewFrameRef}
                title={`${previewDevice} homepage preview`}
                src={publicPath("/?editorPreview=1")}
                onLoad={() =>
                  previewFrameRef.current?.contentWindow?.postMessage(
                    { type: "scholarcanvas:preview", content: draft },
                    window.location.origin,
                  )
                }
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
