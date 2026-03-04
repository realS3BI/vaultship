import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { parse } from "yaml";
import { UserError } from "./errors";

const WORKSPACE_FILE = "pnpm-workspace.yaml";

interface WorkspaceConfig {
  packages?: string[];
}

export function isMonorepo(cwd = process.cwd()): boolean {
  return fs.existsSync(path.join(cwd, WORKSPACE_FILE));
}

export function getWorkspacePackagePaths(cwd = process.cwd()): string[] {
  const workspacePath = path.join(cwd, WORKSPACE_FILE);

  if (!fs.existsSync(workspacePath)) {
    return [];
  }

  const parsed = parse(fs.readFileSync(workspacePath, "utf8")) as WorkspaceConfig;
  const patterns = parsed.packages ?? [];

  if (!Array.isArray(patterns)) {
    throw new UserError("pnpm-workspace.yaml is malformed. Expected a packages array.");
  }

  const results = new Set<string>();

  for (const pattern of patterns) {
    const packageJsonPaths = globSync(path.posix.join(pattern, "package.json"), {
      cwd,
      absolute: true,
      ignore: ["**/node_modules/**"],
    });

    for (const packageJsonPath of packageJsonPaths) {
      results.add(path.dirname(packageJsonPath));
    }
  }

  return [...results].sort();
}
