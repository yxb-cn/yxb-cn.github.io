import { execFile } from "node:child_process";
import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const warningFileSize = 50 * 1024 * 1024;
const maximumGitHubFileSize = 100 * 1024 * 1024;
const generatedEntries = [
  "node_modules",
  ".next",
  ".vinext",
  "out",
  "coverage",
  "dist",
  ".wrangler",
  "output",
  "tmp",
  "work",
  "next-env.d.ts",
];
const localGeneratedDirectories = ["node_modules", ".next", ".vinext", "out"];

async function runGit(projectRoot, args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

function splitNullSeparated(output) {
  return output.split("\0").filter(Boolean);
}

function normalizedGitPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function matchesEntry(filePath, entry) {
  return filePath === entry || filePath.startsWith(`${entry}/`);
}

function isSensitiveFile(filePath) {
  const name = path.posix.basename(filePath).toLowerCase();
  if (name === ".env.example" || name === ".env.sample") {
    return false;
  }
  return (
    name === ".env" ||
    name.startsWith(".env.") ||
    name.endsWith(".pem") ||
    name.endsWith(".key")
  );
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function inspectRepositoryForGitHub(projectDirectory) {
  const projectRoot = path.resolve(projectDirectory);
  const result = {
    checkedAt: new Date().toISOString(),
    gitRepository: false,
    ready: true,
    includedFiles: 0,
    includedBytes: 0,
    ignoredLocalDirectories: [],
    issues: [],
  };

  let repositoryRoot;
  let includedPaths;
  let trackedPaths;

  try {
    repositoryRoot = (
      await runGit(projectRoot, ["rev-parse", "--show-toplevel"])
    ).trim();
    includedPaths = splitNullSeparated(
      await runGit(projectRoot, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ]),
    ).map(normalizedGitPath);
    trackedPaths = new Set(
      splitNullSeparated(
        await runGit(projectRoot, ["ls-files", "--cached", "-z"]),
      ).map(normalizedGitPath),
    );
    result.gitRepository = true;
  } catch {
    result.issues.push({
      level: "warning",
      path: ".git",
      message:
        "This folder is not a Git repository yet, so the editor cannot calculate what GitHub will receive.",
    });
    return result;
  }

  const comparableProjectRoot = (await realpath(projectRoot)).toLowerCase();
  const comparableRepositoryRoot = (
    await realpath(path.resolve(repositoryRoot))
  ).toLowerCase();
  if (comparableRepositoryRoot !== comparableProjectRoot) {
    result.issues.push({
      level: "error",
      path: ".git",
      message:
        "The editor is running inside a parent Git repository instead of this project’s own repository.",
    });
  }

  const includedFilePaths = [];
  for (const relativePath of [...new Set(includedPaths)]) {
    const absolutePath = path.resolve(
      projectRoot,
      ...relativePath.split("/"),
    );
    const relativeCheck = path.relative(projectRoot, absolutePath);
    if (
      !relativeCheck ||
      relativeCheck.startsWith("..") ||
      path.isAbsolute(relativeCheck)
    ) {
      result.issues.push({
        level: "error",
        path: relativePath,
        message: "Git reported a file outside the project folder.",
      });
      continue;
    }

    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        continue;
      }
      includedFilePaths.push(relativePath);
      result.includedFiles += 1;
      result.includedBytes += fileStat.size;

      if (fileStat.size >= maximumGitHubFileSize) {
        result.issues.push({
          level: "error",
          path: relativePath,
          message:
            "This file is 100 MB or larger and cannot be pushed to a normal GitHub repository.",
        });
      } else if (fileStat.size >= warningFileSize) {
        result.issues.push({
          level: "warning",
          path: relativePath,
          message:
            "This file is larger than 50 MB. GitHub accepts it, but the repository may become slow to clone.",
        });
      }
    } catch {
      // Deleted tracked files are valid Git changes and have no local size.
    }
  }

  for (const entry of generatedEntries) {
    const riskyPaths = includedFilePaths.filter((filePath) =>
      matchesEntry(filePath, entry),
    );
    if (riskyPaths.length === 0) {
      continue;
    }
    const alreadyTracked = riskyPaths.some((filePath) =>
      trackedPaths.has(filePath),
    );
    result.issues.push({
      level: "error",
      path: entry,
      message: alreadyTracked
        ? `${entry} is already tracked by Git. Remove it from Git tracking before publishing.`
        : `${entry} is not ignored and could be added to Git. Add it to .gitignore before publishing.`,
    });
  }

  for (const filePath of includedFilePaths.filter(isSensitiveFile)) {
    result.issues.push({
      level: "error",
      path: filePath,
      message:
        "This environment or private-key file could be published. Remove it from Git tracking and keep it local.",
    });
  }

  for (const directory of localGeneratedDirectories) {
    const absolutePath = path.join(projectRoot, directory);
    if (
      (await pathExists(absolutePath)) &&
      !includedFilePaths.some((filePath) =>
        matchesEntry(filePath, directory),
      )
    ) {
      result.ignoredLocalDirectories.push(directory);
    }
  }

  result.ready = !result.issues.some((issue) => issue.level === "error");
  return result;
}
