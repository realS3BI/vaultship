import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { getProjectConfig } from "@lib/project-config";
import { writeReleaseWorkflow } from "@lib/release-workflow";
import { warning, success } from "@lib/output";
import { getTemplatePath } from "@lib/runtime";
import { getPackageJson, savePackageJson } from "@lib/version";
import { wrapCommand } from "../command-utils";

function copyTemplate(templateRelativePath: string, targetPath: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(getTemplatePath(templateRelativePath), targetPath);
}

function ensureScripts(): void {
  const packageJson = getPackageJson();
  packageJson.scripts ??= {};

  const desiredScripts: Record<string, string> = {
    release: "vaultship release",
    "release:minor": "vaultship release --minor",
    "release:major": "vaultship release --major",
    "env:push": "vaultship env push",
    "env:pull": "vaultship env pull",
  };

  for (const [name, value] of Object.entries(desiredScripts)) {
    if (packageJson.scripts[name]) {
      continue;
    }

    packageJson.scripts[name] = value;
    warning(`Added missing package.json script '${name}'.`);
  }

  savePackageJson(packageJson);
}

function runUpdate(): void {
  const projectConfig = getProjectConfig();

  writeReleaseWorkflow(projectConfig.releaseTargets);
  copyTemplate("commitlint.config.js", path.join(process.cwd(), "commitlint.config.js"));
  copyTemplate("husky/commit-msg", path.join(process.cwd(), ".husky", "commit-msg"));

  ensureScripts();
  success("vaultship files updated!");
}

export function createUpdateCommand(): Command {
  return new Command("update")
    .description("Update workflow files and hooks")
    .action(wrapCommand(runUpdate));
}
