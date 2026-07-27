import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  isSameProject,
  readEditorHealth,
  resolveEditorTarget,
} from "./resolve-editor-port.mjs";

const projectRoot = path.resolve(process.cwd());
const skipBrowser = process.env.HOMEPAGE_EDITOR_NO_BROWSER === "1";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function openBrowser(url) {
  let command;
  let args;

  if (process.platform === "win32") {
    command = "rundll32.exe";
    args = ["url.dll,FileProtocolHandler", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const opener = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  opener.on("error", () => {});
  opener.unref();
}

async function waitForProject(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = await readEditorHealth(port, 1_500);
    if (health && isSameProject(health.projectRoot, projectRoot)) {
      return true;
    }
    await delay(1_000);
  }
  return false;
}

async function main() {
  const target = await resolveEditorTarget({ projectRoot });
  const editorUrl = `http://127.0.0.1:${target.port}/editor/`;

  if (target.mode === "existing") {
    process.stdout.write(
      `ScholarCanvas is already running for this folder.\nEditor: ${editorUrl}\n`,
    );
    if (!skipBrowser) {
      openBrowser(editorUrl);
    }
    return;
  }

  const vinextCli = path.resolve(
    projectRoot,
    "node_modules",
    "vinext",
    "dist",
    "cli.js",
  );
  if (!existsSync(vinextCli)) {
    throw new Error(
      "The editor dependencies are missing. Run pnpm install and try again.",
    );
  }

  if (target.port !== 3001) {
    process.stdout.write(
      `Port 3001 is unavailable. Using port ${target.port} instead.\n`,
    );
  }
  process.stdout.write(
    `Starting ScholarCanvas for this folder.\nEditor: ${editorUrl}\nKeep this window open to keep the local editor running.\n\n`,
  );

  const child = spawn(
    process.execPath,
    [
      vinextCli,
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(target.port),
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (!skipBrowser) {
    void waitForProject(target.port).then((ready) => {
      if (ready) {
        openBrowser(editorUrl);
      } else {
        process.stderr.write(
          `The editor did not become ready. Open ${editorUrl} after checking the messages above.\n`,
        );
      }
    });
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "The editor could not be started."}\n`,
  );
  process.exitCode = 1;
});
