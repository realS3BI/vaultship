import fs from "node:fs";
import path from "node:path";
import { UserError } from "./errors";

export interface ReleaseTargets {
  docker: boolean;
  dockerContext: string;
  dockerImage: string;
  npmTrustedPublisher: boolean;
  convex: boolean;
  webhook: boolean;
}

export interface ProjectConfig {
  projectId: string;
  releaseTargets: ReleaseTargets;
}

interface ParsedProjectConfig {
  projectId: string;
  convexDeploy?: boolean;
  releaseTargets?: Partial<ReleaseTargets>;
}

const PROJECT_CONFIG_FILE = ".vaultshiprc.json";

export function getProjectConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PROJECT_CONFIG_FILE);
}

export function defaultReleaseTargets(): ReleaseTargets {
  return {
    docker: false,
    dockerContext: ".",
    dockerImage: "",
    npmTrustedPublisher: false,
    convex: false,
    webhook: false,
  };
}

function normalizeReleaseTargets(raw: ParsedProjectConfig): ReleaseTargets {
  const defaults = defaultReleaseTargets();
  const dockerContextRaw = raw.releaseTargets?.dockerContext ?? defaults.dockerContext;
  const dockerContext =
    !dockerContextRaw || dockerContextRaw === "."
      ? "."
      : dockerContextRaw.trim().replace(/^\.?\//, "").replace(/\\/g, "/");

  return {
    docker: raw.releaseTargets?.docker ?? defaults.docker,
    dockerContext,
    dockerImage: raw.releaseTargets?.dockerImage ?? defaults.dockerImage,
    npmTrustedPublisher:
      raw.releaseTargets?.npmTrustedPublisher ?? defaults.npmTrustedPublisher,
    convex: raw.releaseTargets?.convex ?? raw.convexDeploy ?? defaults.convex,
    webhook: raw.releaseTargets?.webhook ?? defaults.webhook,
  };
}

export function getProjectConfig(cwd = process.cwd()): ProjectConfig {
  const configPath = getProjectConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    throw new UserError("No .vaultshiprc.json found. Run: vaultship init");
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<ParsedProjectConfig>;

    if (!parsed.projectId) {
      throw new UserError("Project config is malformed. Missing projectId in .vaultshiprc.json.");
    }

    return {
      projectId: parsed.projectId,
      releaseTargets: normalizeReleaseTargets(parsed as ParsedProjectConfig),
    };
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
