import path from "node:path";
import { fileURLToPath } from "node:url";

export function getPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function getTemplatePath(relativePath: string): string {
  return path.join(getPackageRoot(), "src", "templates", relativePath);
}
