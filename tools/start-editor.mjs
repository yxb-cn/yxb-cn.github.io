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
const requestedPort = Number.parseInt(
  process.env.SCHOLARCANVAS_PORT ?? "3001",
  10,
);

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

function stripTerminalFormatting(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function observeStartedPort(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;

    function finishWithPort(port) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(port);
    }

    function fail(error) {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    }

    function forwardOutput(chunk, destination) {
      destination.write(chunk);
      if (settled) {
        return;
      }

      output = `${output}${stripTerminalFormatting(chunk.toString())}`.slice(
        -8_192,
      );
      const match = output.match(
        /\bLocal:\s+http:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//,
      );
      if (match) {
        finishWithPort(Number.parseInt(match[1], 10));
      }
    }

    child.stdout.on("data", (chunk) => forwardOutput(chunk, process.stdout));
    child.stderr.on("data", (chunk) => forwardOutput(chunk, process.stderr));
    child.once("error", fail);
    child.once("exit", (code) => {
      fail(
        new Error(
          `The development server stopped before reporting its address (exit code ${code ?? "unknown"}).`,
        ),
      );
    });
  });
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
  const target = await resolveEditorTarget({
    projectRoot,
    startPort: requestedPort,
  });

  if (target.mode === "existing") {
    const editorUrl = `http://127.0.0.1:${target.port}/editor/`;
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

  if (target.port !== requestedPort) {
    process.stdout.write(
      `Port ${requestedPort} is unavailable. Using port ${target.port} instead.\n`,
    );
  }
  process.stdout.write(
    "Starting ScholarCanvas for this folder.\n" +
      "The browser will open after the final local address is ready.\n" +
      "Keep this window open to keep the local editor running.\n\n",
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
      stdio: ["inherit", "pipe", "pipe"],
    },
  );

  void observeStartedPort(child)
    .then(async (startedPort) => {
      const editorUrl = `http://127.0.0.1:${startedPort}/editor/`;
      const ready = await waitForProject(startedPort);
      if (!ready) {
        process.stderr.write(
          `The editor did not become ready. Open ${editorUrl} after checking the messages above.\n`,
        );
        return;
      }

      if (startedPort !== target.port) {
        process.stdout.write(
          `Port ${target.port} became unavailable. Using port ${startedPort} instead.\n`,
        );
      }
      process.stdout.write(`Editor: ${editorUrl}\n`);
      if (!skipBrowser) {
        openBrowser(editorUrl);
      }
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "The editor address could not be detected."}\n`,
      );
    });

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
