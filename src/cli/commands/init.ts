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
import {
  defaultReleaseTargets,
  getProjectConfig,
  getProjectConfigPath,
  ProjectConfig,
  ReleaseTargets,
  saveProjectConfig,
} from "@lib/project-config";
import { writeReleaseWorkflow } from "@lib/release-workflow";
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
  dockerRelease: boolean;
  npmTrustedPublisher: boolean;
  convexDeploy: boolean;
  webhookTrigger: boolean;
  installPeers?: boolean;
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
  releaseTargets: ReleaseTargets,
): Promise<InitAnswers> {
  const questions = [];

  if (missingConfig.apiUrl) {
    questions.push({
      type: "text" as const,
      name: "apiUrl",
      message: "Enter Vaultship server URL:",
      validate: (value: string) => (value ? true : "API URL is required."),
    });
  }

  if (missingConfig.apiKey) {
    questions.push({
      type: "password" as const,
      name: "apiKey",
      message: "Enter Vaultship API key:",
      validate: (value: string) => (value ? true : "API key is required."),
    });
  }

  questions.push({
    type: "confirm" as const,
    name: "dockerRelease",
    initial: releaseTargets.docker,
    message: "Enable Docker publish to GHCR on release?",
  });

  questions.push({
    type: "confirm" as const,
    name: "npmTrustedPublisher",
    initial: releaseTargets.npmTrustedPublisher,
    message: "Enable npm publish via Trusted Publisher on release?",
  });

  questions.push({
    type: "confirm" as const,
    name: "convexDeploy",
    initial: releaseTargets.convex,
    message: "Enable Convex deploy on release?",
  });

  questions.push({
    type: "confirm" as const,
    name: "webhookTrigger",
    initial: releaseTargets.webhook,
    message: "Enable deployment webhook trigger on release?",
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

function printReleaseTargetSummary(releaseTargets: ReleaseTargets): void {
  info("Release targets:");
  info("- GitHub Release: enabled (always)");
  info(`- Docker (GHCR): ${releaseTargets.docker ? "enabled" : "disabled"}`);
  info(`- npm (Trusted Publisher): ${releaseTargets.npmTrustedPublisher ? "enabled" : "disabled"}`);
  info(`- Convex deploy: ${releaseTargets.convex ? "enabled" : "disabled"}`);
  info(`- Deployment webhook: ${releaseTargets.webhook ? "enabled" : "disabled"}`);
}

function printSetupInstructions(releaseTargets: ReleaseTargets): void {
  info("");
  info("Release setup requirements:");
  info("- Optional but recommended: GitHub secret VAULTSHIP_RELEASE_TOKEN (PAT with repo write) for reliable tag-push side effects.");
  info("- Release workflow file: .github/workflows/release.yml");
  info("- Trigger condition: merge PR from branch release/vX.Y.Z into main");

  if (releaseTargets.docker) {
    info("- Docker (GHCR): add a root Dockerfile and set workflow permission to Read and write for Actions.");
  }

  if (releaseTargets.npmTrustedPublisher) {
    info("- npm Trusted Publisher: in npm package settings, add this GitHub repo + workflow '.github/workflows/release.yml'.");
    info("- npm publish checks tag/version match and runs 'pnpm publish --provenance'.");
  }

  if (releaseTargets.convex) {
    info("- Convex: add GitHub secret CONVEX_DEPLOY_KEY (Settings > Secrets and variables > Actions > Secrets).");
  }

  if (releaseTargets.webhook) {
    info("- Webhook: add GitHub variable DEPLOY_WEBHOOK_URL and optional secret DEPLOY_WEBHOOK_SECRET.");
  }

  info("- Re-run 'vaultship init' anytime to change these options.");
}

function loadExistingProjectConfig(projectConfigPath: string): ProjectConfig | undefined {
  if (!fs.existsSync(projectConfigPath)) {
    return undefined;
  }

  return getProjectConfig();
}

async function confirmReinitialize(projectConfigExists: boolean): Promise<void> {
  if (!projectConfigExists) {
    return;
  }

  const response = await prompts(
    {
      type: "confirm",
      name: "reinitialize",
      message: "Project already initialized. Update configuration?",
      initial: true,
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

async function runInit(): Promise<void> {
  const projectConfigPath = getProjectConfigPath();
  const existingProjectConfig = loadExistingProjectConfig(projectConfigPath);

  await confirmReinitialize(Boolean(existingProjectConfig));

  const projectId = existingProjectConfig?.projectId ?? uuidv4();
  const releaseTargetsDefaults = existingProjectConfig?.releaseTargets ?? defaultReleaseTargets();
  const globalConfig = getGlobalConfig();
  const missingPeers = findMissingPeers();
  const answers = await promptForInit(
    {
      apiUrl: !globalConfig.apiUrl,
      apiKey: !globalConfig.apiKey,
    },
    missingPeers,
    releaseTargetsDefaults,
  );

  const releaseTargets: ReleaseTargets = {
    docker: answers.dockerRelease,
    npmTrustedPublisher: answers.npmTrustedPublisher,
    convex: answers.convexDeploy,
    webhook: answers.webhookTrigger,
  };

  if (!globalConfig.apiUrl && answers.apiUrl) {
    globalConfig.apiUrl = answers.apiUrl;
  }

  if (!globalConfig.apiKey && answers.apiKey) {
    globalConfig.apiKey = answers.apiKey;
  }

  let encryptionKey = globalConfig.projects[projectId]?.encryptionKey;
  let createdEncryptionKey = false;

  if (!encryptionKey) {
    encryptionKey = generateEncryptionKey();
    globalConfig.projects[projectId] = { encryptionKey };
    createdEncryptionKey = true;
  }

  saveGlobalConfig(globalConfig);

  saveProjectConfig({
    projectId,
    releaseTargets,
  });

  writeReleaseWorkflow(releaseTargets);
  copyTemplate("commitlint.config.js", path.join(process.cwd(), "commitlint.config.js"));

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

  const envVaultshipPath = path.join(process.cwd(), ".env.vaultship");
  const apiKeyToWrite = globalConfig.apiKey ?? "";
  if (apiKeyToWrite) {
    fs.writeFileSync(
      envVaultshipPath,
      `# Vaultship API key (do not commit)\nVAULTSHIP_API_KEY=${apiKeyToWrite}\n`,
      "utf8",
    );
  }

  success(existingProjectConfig ? "vaultship configuration updated!" : "vaultship initialized!");
  info(`Project ID: ${projectId}`);
  if (createdEncryptionKey) {
    info(`Encryption Key: ${encryptionKey}`);
    warning("Save this encryption key in KeePass. It cannot be recovered.");
  } else {
    info("Encryption key: reused existing value from global config.");
  }

  printReleaseTargetSummary(releaseTargets);
  printSetupInstructions(releaseTargets);

  info("");
  info("Files written:");
  info("- .vaultshiprc.json");
  info("- .github/workflows/release.yml");
  info("- commitlint.config.js");
  info("- .husky/commit-msg");
  if (apiKeyToWrite) {
    info("- .env.vaultship (VAULTSHIP_API_KEY)");
  }
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize vaultship in the current project")
    .action(wrapCommand(runInit));
}
