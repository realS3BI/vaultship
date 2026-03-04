import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import { getApiKey, getApiUrl, getEncryptionKey } from "@lib/config";
import { decrypt } from "@lib/crypto";
import { UserError } from "@lib/errors";
import { success } from "@lib/output";
import { createEnvSyncClient } from "@lib/env-sync-client";
import { getProjectConfig } from "@lib/project-config";
import { wrapCommand } from "../command-utils";

async function runEnvPull(): Promise<void> {
  const { projectId } = getProjectConfig();
  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  const encryptionKey = getEncryptionKey(projectId);
  const envPath = path.join(process.cwd(), ".env");

  if (fs.existsSync(envPath)) {
    const answer = await prompts(
      {
        type: "confirm",
        name: "overwrite",
        initial: false,
        message: "Overwrite existing .env?",
      },
      {
        onCancel: () => {
          throw new UserError("Environment pull cancelled.");
        },
      },
    );

    if (!answer.overwrite) {
      throw new UserError("Environment pull aborted.");
    }
  }

  const spinner = ora("Pulling environment variables from Vaultship server").start();

  try {
    const client = createEnvSyncClient(apiUrl, apiKey);
    const encryptedPayload = await client.pullEnv(projectId);

    if (!encryptedPayload) {
      throw new UserError("No environment variables found for this project.");
    }

    const plaintext = decrypt(encryptedPayload, encryptionKey);
    fs.writeFileSync(envPath, plaintext, "utf8");
    spinner.succeed("Environment variables pulled");
  } catch (error) {
    spinner.fail("Failed to pull environment variables");
    throw error;
  }

  success("Environment variables pulled and saved to .env");
}

export function createEnvPullCommand(): Command {
  return new Command("pull")
    .description("Pull .env from Vaultship server")
    .action(wrapCommand(runEnvPull));
}
