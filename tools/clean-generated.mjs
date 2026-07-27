import { rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const generatedDirectories = [".next", ".vinext", "out"];

for (const directory of generatedDirectories) {
  const target = path.resolve(projectRoot, directory);
  const relativeTarget = path.relative(projectRoot, target);

  if (
    !relativeTarget ||
    relativeTarget.startsWith("..") ||
    path.isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to remove an unsafe path: ${target}`);
  }

  await rm(target, { force: true, recursive: true });
  console.log(`Removed ${relativeTarget}`);
}
