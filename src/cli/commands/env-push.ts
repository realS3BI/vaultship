import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import { getApiKey, getApiUrl, getEncryptionKey } from "@lib/config";
import { encrypt } from "@lib/crypto";
import { UserError } from "@lib/errors";
import { success } from "@lib/output";
import { createEnvSyncClient } from "@lib/env-sync-client";
import { getProjectConfig } from "@lib/project-config";
import { wrapCommand } from "../command-utils";

async function runEnvPush(): Promise<void> {
  const { projectId } = getProjectConfig();
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    throw new UserError("No .env file found in current directory.");
  }

  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  const encryptionKey = getEncryptionKey(projectId);
  const content = fs.readFileSync(envPath, "utf8");
  const encryptedPayload = encrypt(content, encryptionKey);
  const spinner = ora("Pushing environment variables to Vaultship server").start();

  try {
    const client = createEnvSyncClient(apiUrl, apiKey);
    await client.pushEnv(projectId, encryptedPayload);
    spinner.succeed("Environment variables pushed");
  } catch (error) {
    spinner.fail("Failed to push environment variables");
    throw error;
  }

  success(`Environment variables pushed for project ${projectId}`);
}

export function createEnvPushCommand(): Command {
  return new Command("push")
    .description("Push .env to Vaultship server")
    .action(wrapCommand(runEnvPush));
}
