import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  migrateSiteContent,
  validateSiteContent,
} from "../app/content-schema";
import { inspectRepositoryForGitHub } from "./repository-check.mjs";

const endpoint = "/__content-editor";
const healthEndpoint = "/__scholarcanvas-health";
const photoEndpoint = "/__profile-photo";
const pageAssetEndpoint = "/__page-asset";
const repositoryCheckEndpoint = "/__repository-check";
const projectRoot = path.resolve(process.cwd());
const contentPath = path.resolve(projectRoot, "content", "site-content.json");
const maximumBodySize = 8 * 1024 * 1024;
const maximumPhotoSize = 5 * 1024 * 1024;
const maximumPageAssetSize = 25 * 1024 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function requestIsLocal(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) {
    return false;
  }

  try {
    const hostname = new URL(`http://${host}`).hostname;
    if (!isLocalHostname(hostname)) {
      return false;
    }

    const origin = request.headers.origin;
    return !origin || isLocalHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readRequestBuffer(
  request: IncomingMessage,
  maximumSize: number,
) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumSize) {
      throw new Error("The selected file is too large.");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readRequestBody(request: IncomingMessage) {
  return (await readRequestBuffer(request, maximumBodySize)).toString("utf8");
}

function photoExtension(contentType: string | undefined, buffer: Buffer) {
  if (
    contentType === "image/jpeg" &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return ".jpg";
  }

  if (
    contentType === "image/png" &&
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
  ) {
    return ".png";
  }

  if (
    contentType === "image/webp" &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }

  return null;
}

function pageAssetExtension(
  contentType: string | undefined,
  buffer: Buffer,
) {
  const photo = photoExtension(contentType, buffer);
  if (photo) {
    return photo;
  }

  if (
    contentType === "image/gif" &&
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))
  ) {
    return ".gif";
  }

  if (
    contentType === "application/pdf" &&
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  ) {
    return ".pdf";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeFileStem(fileName: string) {
  return (
    path
      .parse(fileName)
      .name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "file"
  );
}

function pathIsInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function pageCollectionEntries(content: Record<string, unknown>) {
  const entries: Array<{
    sectionId: string;
    slug: string;
    item: Record<string, unknown>;
  }> = [];
  const sections = Array.isArray(content.mainSections)
    ? content.mainSections
    : [];

  for (const section of sections) {
    if (
      !isRecord(section) ||
      section.template !== "pageCollection" ||
      typeof section.id !== "string" ||
      !slugPattern.test(section.id) ||
      !Array.isArray(section.content)
    ) {
      continue;
    }

    for (const item of section.content) {
      if (
        !isRecord(item) ||
        typeof item.slug !== "string" ||
        !slugPattern.test(item.slug)
      ) {
        continue;
      }
      entries.push({
        sectionId: section.id,
        slug: item.slug,
        item,
      });
    }
  }

  return entries;
}

function markdownFilePath(sectionId: string, slug: string) {
  return path.resolve(
    process.cwd(),
    "public",
    "page-content",
    sectionId,
    slug,
    "index.md",
  );
}

async function existingMarkdownBody(item: Record<string, unknown>) {
  if (typeof item.markdownPath !== "string") {
    return "";
  }

  const allowedRoot = item.markdownPath.startsWith("public/page-content/")
    ? path.resolve(process.cwd(), "public", "page-content")
    : item.markdownPath.startsWith("content/pages/")
      ? path.resolve(process.cwd(), "content", "pages")
      : null;
  if (!allowedRoot) {
    return "";
  }

  const filePath = path.resolve(process.cwd(), item.markdownPath);
  if (!pathIsInside(allowedRoot, filePath)) {
    return "";
  }

  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function hydratePageMarkdown(content: Record<string, unknown>) {
  for (const { item } of pageCollectionEntries(content)) {
    if (typeof item.body !== "string") {
      item.body = await existingMarkdownBody(item);
    }
  }
  return content;
}

function markdownFileReferences(markdown: string) {
  const urls = new Set<string>();
  const markdownLinkPattern =
    /!?\[[^\]]*]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  const htmlFilePattern =
    /<(?:img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;

  for (const match of markdown.matchAll(markdownLinkPattern)) {
    urls.add(match[1] || match[2]);
  }
  for (const match of markdown.matchAll(htmlFilePattern)) {
    urls.add(match[1]);
  }

  return [...urls];
}

async function filesRecursively(root: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesRecursively(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function removeEmptyDirectories(root: string) {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirectories(path.join(root, entry.name));
    }
  }

  try {
    const remaining = await readdir(root);
    if (remaining.length === 0) {
      await rmdir(root);
    }
  } catch {
    // A non-empty or concurrently changed folder should simply remain.
  }
}

async function cleanupGeneratedFiles(
  root: string,
  referenced: Set<string>,
  shouldManage: (filePath: string) => boolean,
) {
  const removed: string[] = [];
  for (const filePath of await filesRecursively(root)) {
    if (!shouldManage(filePath) || referenced.has(filePath)) {
      continue;
    }
    await unlink(filePath);
    removed.push(filePath);
  }
  await removeEmptyDirectories(root);
  return removed;
}

async function migrateLegacyPageFiles(
  body: string,
  entryDirectory: string,
  sectionId: string,
  slug: string,
) {
  const legacyRoot = path.resolve(process.cwd(), "public", "page-assets");
  let migratedBody = body;

  for (const reference of markdownFileReferences(body)) {
    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference.startsWith("/page-assets/")) {
      continue;
    }

    const sourcePath = path.resolve(
      process.cwd(),
      "public",
      cleanReference.replace(/^\/+/, ""),
    );
    if (!pathIsInside(legacyRoot, sourcePath)) {
      continue;
    }

    try {
      const fileName = path.basename(sourcePath);
      await mkdir(entryDirectory, { recursive: true });
      await writeFile(
        path.join(entryDirectory, fileName),
        await readFile(sourcePath),
      );
      const nextReference = `/page-content/${sectionId}/${slug}/${fileName}`;
      migratedBody = migratedBody.replaceAll(cleanReference, nextReference);
    } catch {
      // Keep a missing legacy reference visible so validation can report it.
    }
  }

  return migratedBody;
}

async function persistPageMarkdown(content: Record<string, unknown>) {
  const pagesRoot = path.resolve(process.cwd(), "public", "page-content");
  const legacyPagesRoot = path.resolve(process.cwd(), "content", "pages");
  const legacyAssetsRoot = path.resolve(process.cwd(), "public", "page-assets");
  const referencedFiles = new Set<string>();

  for (const { sectionId, slug, item } of pageCollectionEntries(content)) {
    const existingBody =
      typeof item.body === "string"
        ? item.body
        : await existingMarkdownBody(item);
    const filePath = markdownFilePath(sectionId, slug);
    const entryDirectory = path.dirname(filePath);
    const body = await migrateLegacyPageFiles(
      existingBody,
      entryDirectory,
      sectionId,
      slug,
    );
    await mkdir(entryDirectory, { recursive: true });
    await writeFile(filePath, body, "utf8");
    referencedFiles.add(filePath);

    const relativeMarkdownPath = path
      .relative(process.cwd(), filePath)
      .split(path.sep)
      .join("/");
    item.markdownPath = relativeMarkdownPath;
    delete item.body;

    for (const reference of markdownFileReferences(body)) {
      const cleanReference = reference.split(/[?#]/, 1)[0];
      if (!cleanReference.startsWith("/page-content/")) {
        continue;
      }
      const referencedPath = path.resolve(
        process.cwd(),
        "public",
        cleanReference.replace(/^\/+/, ""),
      );
      if (pathIsInside(pagesRoot, referencedPath)) {
        referencedFiles.add(referencedPath);
      }
    }
  }

  const removedPageContent = await cleanupGeneratedFiles(
    pagesRoot,
    referencedFiles,
    () => true,
  );
  const removedLegacyMarkdown = await cleanupGeneratedFiles(
    legacyPagesRoot,
    new Set(),
    () => true,
  );
  const removedLegacyAssets = await cleanupGeneratedFiles(
    legacyAssetsRoot,
    new Set(),
    () => true,
  );

  return {
    removedPageFiles: [
      ...removedPageContent,
      ...removedLegacyMarkdown,
    ],
    removedPageAssets: removedLegacyAssets,
  };
}

function looksLikeSiteContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const content = value as Record<string, unknown>;
  const requiredArrays = [
    "contacts",
    "education",
    "researchTopics",
    "publicationGroups",
    "projects",
    "codeProjects",
    "talks",
    "serviceAndSkills",
  ];

  return (
    Boolean(content.profile) &&
    requiredArrays.every((key) => Array.isArray(content[key]))
  );
}

const generatedProfileImagePattern =
  /^profile-(?:about|nav|original|photo)-[a-f0-9]{8,}\.(?:jpe?g|png|webp)$/i;

function referencedProfileImageNames(content: Record<string, unknown>) {
  const referenced = new Set<string>();
  const profile =
    content.profile &&
    typeof content.profile === "object" &&
    !Array.isArray(content.profile)
      ? (content.profile as Record<string, unknown>)
      : {};

  for (const key of ["photoPath", "navPhotoPath", "originalPhotoPath"]) {
    const value = profile[key];
    if (typeof value === "string" && value.startsWith("/images/")) {
      referenced.add(path.basename(value));
    }
  }

  return referenced;
}

async function cleanupUnusedProfileImages(
  content: Record<string, unknown>,
) {
  const imageDirectory = path.resolve(process.cwd(), "public", "images");
  const referenced = referencedProfileImageNames(content);
  let entries: Dirent[];

  try {
    entries = await readdir(imageDirectory, { withFileTypes: true });
  } catch {
    return [];
  }

  const removed: string[] = [];
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !generatedProfileImagePattern.test(entry.name) ||
      referenced.has(entry.name)
    ) {
      continue;
    }
    await unlink(path.join(imageDirectory, entry.name));
    removed.push(entry.name);
  }

  return removed;
}

export function contentEditorPlugin(): Plugin {
  return {
    name: "local-content-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        healthEndpoint,
        async (request, response, next) => {
          if (!requestIsLocal(request)) {
            sendJson(response, 403, {
              error: "The local editor status is available only on this computer.",
            });
            return;
          }

          if (request.method === "GET") {
            sendJson(response, 200, {
              product: "ScholarCanvas",
              projectRoot,
            });
            return;
          }

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }

          next();
        },
      );

      server.middlewares.use(
        repositoryCheckEndpoint,
        async (request, response, next) => {
          if (!requestIsLocal(request)) {
            sendJson(response, 403, {
              error:
                "The repository check is available only on this computer.",
            });
            return;
          }

          if (request.method === "GET") {
            try {
              sendJson(
                response,
                200,
                await inspectRepositoryForGitHub(projectRoot),
              );
            } catch (error) {
              sendJson(response, 500, {
                error:
                  error instanceof Error
                    ? error.message
                    : "The repository could not be checked.",
              });
            }
            return;
          }

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }

          next();
        },
      );

      server.middlewares.use(
        photoEndpoint,
        async (request, response, next) => {
          if (!requestIsLocal(request)) {
            sendJson(response, 403, {
              error: "Photo uploads are available only on this computer.",
            });
            return;
          }

          if (request.method === "PUT") {
            try {
              const photo = await readRequestBuffer(request, maximumPhotoSize);
              const extension = photoExtension(
                request.headers["content-type"],
                photo,
              );

              if (!extension) {
                sendJson(response, 400, {
                  error: "Choose a valid JPG, PNG, or WebP image.",
                });
                return;
              }

              const fingerprint = createHash("sha256")
                .update(photo)
                .digest("hex")
                .slice(0, 12);
              const requestUrl = new URL(request.url ?? photoEndpoint, "http://localhost");
              const requestedKind = requestUrl.searchParams.get("kind");
              const photoKind =
                requestedKind === "about" ||
                requestedKind === "nav" ||
                requestedKind === "original"
                  ? requestedKind
                  : "about";
              const fileName = `profile-${photoKind}-${fingerprint}${extension}`;
              const imageDirectory = path.resolve(
                process.cwd(),
                "public",
                "images",
              );

              await mkdir(imageDirectory, { recursive: true });
              await writeFile(path.join(imageDirectory, fileName), photo);

              sendJson(response, 200, {
                saved: true,
                path: `/images/${fileName}`,
              });
            } catch (error) {
              sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "The photo could not be saved.",
              });
            }
            return;
          }

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }

          next();
        },
      );

      server.middlewares.use(
        pageAssetEndpoint,
        async (request, response, next) => {
          if (!requestIsLocal(request)) {
            sendJson(response, 403, {
              error: "Page file uploads are available only on this computer.",
            });
            return;
          }

          if (request.method === "PUT") {
            try {
              const requestUrl = new URL(
                request.url ?? pageAssetEndpoint,
                "http://localhost",
              );
              const sectionId = requestUrl.searchParams.get("section") ?? "";
              const slug = requestUrl.searchParams.get("slug") ?? "";
              const originalName =
                requestUrl.searchParams.get("name") ?? "image";
              if (!slugPattern.test(sectionId) || !slugPattern.test(slug)) {
                sendJson(response, 400, {
                  error:
                    "Set a valid section ID and Page Slug before adding files.",
                });
                return;
              }

              const asset = await readRequestBuffer(
                request,
                maximumPageAssetSize,
              );
              const extension = pageAssetExtension(
                request.headers["content-type"],
                asset,
              );
              if (!extension) {
                sendJson(response, 400, {
                  error:
                    "Choose a valid JPG, PNG, WebP, GIF, or PDF file.",
                });
                return;
              }

              const fingerprint = createHash("sha256")
                .update(asset)
                .digest("hex")
                .slice(0, 10);
              const fileName = `${safeFileStem(originalName)}-${fingerprint}${extension}`;
              const assetDirectory = path.resolve(
                process.cwd(),
                "public",
                "page-content",
                sectionId,
                slug,
              );
              await mkdir(assetDirectory, { recursive: true });
              await writeFile(path.join(assetDirectory, fileName), asset);

              sendJson(response, 200, {
                saved: true,
                path: `/page-content/${sectionId}/${slug}/${fileName}`,
              });
            } catch (error) {
              sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "The page file could not be saved.",
              });
            }
            return;
          }

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }

          next();
        },
      );

      server.middlewares.use(
        endpoint,
        async (request, response, next) => {
          if (!requestIsLocal(request)) {
            sendJson(response, 403, {
              error: "The content editor is available only on this computer.",
            });
            return;
          }

          if (request.method === "GET") {
            try {
              const content = migrateSiteContent(
                JSON.parse(
                  await readFile(contentPath, "utf8"),
                ) as Record<string, unknown>,
              );
              await hydratePageMarkdown(content);
              sendJson(response, 200, content);
            } catch {
              sendJson(response, 500, {
                error: "The content file could not be opened.",
              });
            }
            return;
          }

          if (request.method === "PUT") {
            try {
              const body = await readRequestBody(request);
              const parsed = JSON.parse(body) as unknown;

              if (!looksLikeSiteContent(parsed)) {
                sendJson(response, 400, {
                  error: "The content file is missing required sections.",
                });
                return;
              }
              const content = migrateSiteContent(
                parsed as Record<string, unknown>,
              );
              const validationErrors = validateSiteContent(content).filter(
                (issue) => issue.level === "error",
              );
              if (validationErrors.length > 0) {
                sendJson(response, 400, {
                  error: validationErrors[0].message,
                  issues: validationErrors,
                });
                return;
              }

              const pageCleanup = await persistPageMarkdown(content);
              await writeFile(
                contentPath,
                `${JSON.stringify(content, null, 2)}\n`,
                "utf8",
              );
              const removedImages = await cleanupUnusedProfileImages(content);
              sendJson(response, 200, {
                saved: true,
                removedImages,
                removedPageFiles: pageCleanup.removedPageFiles.length,
                removedPageAssets: pageCleanup.removedPageAssets.length,
              });
            } catch (error) {
              sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "The content could not be saved.",
              });
            }
            return;
          }

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }

          next();
        },
      );
    },
  };
}
