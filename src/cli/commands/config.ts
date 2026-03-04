import { Command } from "commander";
import { getGlobalConfig, saveGlobalConfig } from "@lib/config";
import { UserError } from "@lib/errors";
import { info, maskSecret, success } from "@lib/output";
import { wrapCommand } from "../command-utils";

const SUPPORTED_KEYS = new Set(["apiKey", "apiUrl"]);

function assertSupportedKey(key: string): void {
  if (!SUPPORTED_KEYS.has(key)) {
    throw new UserError(`Unsupported config key: ${key}. Supported keys: apiKey, apiUrl`);
  }
}

export function createConfigCommand(): Command {
  const command = new Command("config").description("Manage global vaultship configuration");

  command
    .command("list")
    .description("List configured values")
    .action(
      wrapCommand(() => {
        const config = getGlobalConfig();
        info(`apiUrl: ${config.apiUrl ?? ""}`);
        info(`apiKey: ${config.apiKey ? maskSecret(config.apiKey) : ""}`);

        for (const [projectId, project] of Object.entries(config.projects)) {
          info(`${projectId}: ${maskSecret(project.encryptionKey)}`);
        }
      }),
    );

  command
    .command("get")
    .argument("<key>")
    .description("Get a config value")
    .action(
      wrapCommand((key: string) => {
        assertSupportedKey(key);
        const config = getGlobalConfig();
        const value = key === "apiKey" ? config.apiKey : config.apiUrl;
        info(value ?? "");
      }),
    );

  command
    .command("set")
    .argument("<key>")
    .argument("<value>")
    .description("Set a config value")
    .action(
      wrapCommand((key: string, value: string) => {
        assertSupportedKey(key);
        const config = getGlobalConfig();

        if (key === "apiKey") {
          config.apiKey = value;
        } else {
          config.apiUrl = value;
        }

        saveGlobalConfig(config);
        success(`Config updated: ${key} = ${key === "apiKey" ? maskSecret(value) : value}`);
      }),
    );

  return command;
}
