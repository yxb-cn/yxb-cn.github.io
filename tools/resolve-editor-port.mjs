import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const editorHealthPath = "/__scholarcanvas-health";

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isSameProject(candidate, projectRoot = process.cwd()) {
  return (
    typeof candidate === "string" &&
    comparablePath(candidate) === comparablePath(projectRoot)
  );
}

export async function readEditorHealth(port, timeoutMs = 500) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}${editorHealthPath}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      return null;
    }

    const value = await response.json();
    if (
      value?.product !== "ScholarCanvas" ||
      typeof value.projectRoot !== "string"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function portIsAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

export async function resolveEditorTarget({
  projectRoot = process.cwd(),
  startPort = Number.parseInt(process.env.SCHOLARCANVAS_PORT ?? "3001", 10),
  portCount = 2_000,
} = {}) {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65535) {
    throw new Error("SCHOLARCANVAS_PORT must be a valid TCP port.");
  }

  const lastPort = Math.min(65535, startPort + portCount - 1);
  for (let port = startPort; port <= lastPort; port += 1) {
    const health = await readEditorHealth(port);
    if (health && isSameProject(health.projectRoot, projectRoot)) {
      return { port, mode: "existing" };
    }

    if (await portIsAvailable(port)) {
      return { port, mode: "new" };
    }
  }

  throw new Error(
    `No available local editor port was found between ${startPort} and ${lastPort}.`,
  );
}

async function main() {
  const target = await resolveEditorTarget();
  process.stdout.write(`${target.port} ${target.mode}\n`);
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "The editor port could not be selected."}\n`,
    );
    process.exitCode = 1;
  });
}
