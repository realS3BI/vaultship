import fs from "node:fs";
import path from "node:path";
import { UserError } from "./errors";

export interface ProjectConfig {
  projectId: string;
  convexDeploy?: boolean;
}

const PROJECT_CONFIG_FILE = ".vaultshiprc.json";

export function getProjectConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PROJECT_CONFIG_FILE);
}

export function getProjectConfig(cwd = process.cwd()): ProjectConfig {
  const configPath = getProjectConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    throw new UserError("No .vaultshiprc.json found. Run: vaultship init");
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as ProjectConfig;
  } catch {
    throw new UserError("Project config is malformed. Fix .vaultshiprc.json and try again.");
  }
}

export function saveProjectConfig(config: ProjectConfig, cwd = process.cwd()): void {
  fs.writeFileSync(
    getProjectConfigPath(cwd),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}
