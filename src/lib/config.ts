import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserError } from "./errors";

export interface ProjectKeys {
  encryptionKey: string;
}

export interface GlobalConfig {
  apiKey?: string;
  apiUrl?: string;
  projects: Record<string, ProjectKeys>;
}

const CONFIG_DIR = path.join(os.homedir(), ".vaultship");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function defaultConfig(): GlobalConfig {
  return { projects: {} };
}

export function getGlobalConfigPath(): string {
  return CONFIG_PATH;
}

export function getGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return defaultConfig();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<GlobalConfig>;

    return {
      apiKey: parsed.apiKey,
      apiUrl: parsed.apiUrl,
      projects: parsed.projects ?? {},
    };
  } catch {
    throw new UserError("Global config is malformed. Fix ~/.vaultship/config.json and try again.");
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Ignore chmod failures on filesystems that do not support POSIX permissions.
  }
}

function readApiKeyFromEnvVaultship(cwd: string): string | undefined {
  const envVaultshipPath = path.join(cwd, ".env.vaultship");
  if (!fs.existsSync(envVaultshipPath)) return undefined;
  const content = fs.readFileSync(envVaultshipPath, "utf8");
  const match = content.match(/^\s*VAULTSHIP_API_KEY\s*=\s*(.+)\s*$/m);
  return match ? match[1].trim() : undefined;
}

export function getApiKey(cwd?: string): string {
  const workDir = cwd ?? process.cwd();
  const fromFile = readApiKeyFromEnvVaultship(workDir);
  if (fromFile) return fromFile;

  const apiKey = getGlobalConfig().apiKey;

  if (!apiKey) {
    throw new UserError("No API key configured. Run: vaultship config set apiKey <key> or add VAULTSHIP_API_KEY to .env.vaultship");
  }

  return apiKey;
}

export function getApiUrl(): string {
  const apiUrl = getGlobalConfig().apiUrl;

  if (!apiUrl) {
    throw new UserError("No API URL configured. Run: vaultship config set apiUrl <url>");
  }

  return apiUrl;
}

export function getEncryptionKey(projectId: string): string {
  const encryptionKey = getGlobalConfig().projects[projectId]?.encryptionKey;

  if (!encryptionKey) {
    throw new UserError(`No encryption key found for project ${projectId}. Run: vaultship init`);
  }

  return encryptionKey;
}
