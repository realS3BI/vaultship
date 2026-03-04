import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import { v4 as uuidv4 } from "uuid";
import { getGlobalConfig, saveGlobalConfig } from "@lib/config";
import { generateEncryptionKey } from "@lib/crypto";
import { UserError } from "@lib/errors";
import { ensureFileContainsLine } from "@lib/fs";
import { info, success, warning } from "@lib/output";
import { getProjectConfigPath, saveProjectConfig } from "@lib/project-config";
import { getTemplatePath } from "@lib/runtime";
import { getPackageJson, savePackageJson } from "@lib/version";
import { wrapCommand } from "../command-utils";

const REQUIRED_PEERS = [
  "husky",
  "@commitlint/cli",
  "@commitlint/config-conventional",
] as const;

interface InitAnswers {
  apiUrl?: string;
  apiKey?: string;
  convexDeploy: boolean;
  installPeers: boolean;
}

function copyTemplate(templateRelativePath: string, targetPath: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(getTemplatePath(templateRelativePath), targetPath);
}

function findMissingPeers(): string[] {
  const packageJson = getPackageJson();
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  return REQUIRED_PEERS.filter((dependency) => !allDeps?.[dependency]);
}

function installMissingPeers(missing: string[]): void {
  if (missing.length === 0) {
    return;
  }

  execSync(`pnpm add -D ${missing.join(" ")}`, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

function installHuskyHook(): void {
  if (!fs.existsSync(path.join(process.cwd(), ".husky"))) {
    execSync("npx husky init", {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  copyTemplate("husky/commit-msg", path.join(process.cwd(), ".husky", "commit-msg"));
}

function updatePackageScripts(): void {
  const packageJson = getPackageJson();
  packageJson.scripts ??= {};

  const scripts: Record<string, string> = {
    release: "vaultship release",
    "release:minor": "vaultship release --minor",
    "release:major": "vaultship release --major",
    "env:push": "vaultship env push",
    "env:pull": "vaultship env pull",
  };

  for (const [name, value] of Object.entries(scripts)) {
    if (packageJson.scripts[name]) {
      warning(`package.json already has a '${name}' script. Skipping.`);
      continue;
    }

    packageJson.scripts[name] = value;
  }

  savePackageJson(packageJson);
}

async function promptForInit(
  missingConfig: { apiUrl: boolean; apiKey: boolean },
  missingPeers: string[],
): Promise<InitAnswers> {
  const questions = [];

  if (missingConfig.apiUrl) {
    questions.push({
      type: "text" as const,
      name: "apiUrl",
      message: "Enter PocketBase API URL:",
      validate: (value: string) => (value ? true : "API URL is required."),
    });
  }

  if (missingConfig.apiKey) {
    questions.push({
      type: "password" as const,
      name: "apiKey",
      message: "Enter PocketBase API Key:",
      validate: (value: string) => (value ? true : "API key is required."),
    });
  }

  questions.push({
    type: "confirm" as const,
    name: "convexDeploy",
    initial: false,
    message: "Enable Convex deploy?",
  });

  if (missingPeers.length > 0) {
    questions.push({
      type: "confirm" as const,
      name: "installPeers",
      initial: true,
      message: `Install missing peer dependencies now? (${missingPeers.join(", ")})`,
    });
  }

  return prompts(questions, {
    onCancel: () => {
      throw new UserError("Initialization cancelled.");
    },
  }) as Promise<InitAnswers>;
}

async function runInit(): Promise<void> {
  const projectConfigPath = getProjectConfigPath();

  if (fs.existsSync(projectConfigPath)) {
    const response = await prompts(
      {
        type: "confirm",
        name: "reinitialize",
        message: "Project already initialized. Reinitialize?",
        initial: false,
      },
      {
        onCancel: () => {
          throw new UserError("Initialization cancelled.");
        },
      },
    );

    if (!response.reinitialize) {
      throw new UserError("Initialization aborted.");
    }
  }

  const globalConfig = getGlobalConfig();
  const missingPeers = findMissingPeers();
  const answers = await promptForInit(
    {
      apiUrl: !globalConfig.apiUrl,
      apiKey: !globalConfig.apiKey,
    },
    missingPeers,
  );
  const projectId = uuidv4();
  const encryptionKey = generateEncryptionKey();

  if (!globalConfig.apiUrl && answers.apiUrl) {
    globalConfig.apiUrl = answers.apiUrl;
  }

  if (!globalConfig.apiKey && answers.apiKey) {
    globalConfig.apiKey = answers.apiKey;
  }

  globalConfig.projects[projectId] = { encryptionKey };
  saveGlobalConfig(globalConfig);

  saveProjectConfig({
    projectId,
    convexDeploy: answers.convexDeploy,
  });

  copyTemplate("release.yml", path.join(process.cwd(), ".github", "workflows", "release.yml"));
  copyTemplate("commitlint.config", path.join(process.cwd(), "commitlint.config"));

  if (missingPeers.length > 0) {
    if (answers.installPeers) {
      const spinner = ora("Installing peer dependencies").start();

      try {
        installMissingPeers(missingPeers);
        spinner.succeed("Peer dependencies installed");
      } catch {
        spinner.fail("Failed to install peer dependencies");
        warning("Missing peer dependencies. Install them with:");
        info("pnpm add -D husky @commitlint/cli @commitlint/config-conventional");
      }
    } else {
      warning("Missing peer dependencies. Install them with:");
      info("pnpm add -D husky @commitlint/cli @commitlint/config-conventional");
    }
  }

  try {
    installHuskyHook();
  } catch {
    warning("Could not install husky automatically. Ensure husky is installed and run 'npx husky init'.");
  }

  ensureFileContainsLine(path.join(process.cwd(), ".gitignore"), ".env.vaultship");
  updatePackageScripts();

  success("vaultship initialized!");
  info(`Project ID: ${projectId}`);
  info(`Encryption Key: ${encryptionKey}`);
  warning("Save this encryption key in KeePass. It cannot be recovered.");
  info("Files created:");
  info("- .vaultshiprc.json");
  info("- .github/workflows/release.yml");
  info("- commitlint.config");
  info("- .husky/commit-msg");
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize vaultship in the current project")
    .action(wrapCommand(runInit));
}
