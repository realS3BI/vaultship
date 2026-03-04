import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { createConfigCommand } from "./commands/config";

// Load .env so GITHUB_TOKEN etc. are available when running release (and other commands)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

import { createEnvPullCommand } from "./commands/env-pull";
import { createEnvPushCommand } from "./commands/env-push";
import { createInitCommand } from "./commands/init";
import { createReleaseCommand } from "./commands/release";
import { createUpdateCommand } from "./commands/update";

const program = new Command();

program
  .name("vaultship")
  .description("Release automation and encrypted environment synchronization")
  .option("--verbose", "Print full stack traces for unexpected errors")
  .addCommand(createInitCommand())
  .addCommand(createUpdateCommand())
  .addCommand(createReleaseCommand());

const envCommand = new Command("env").description("Manage encrypted environment files");
envCommand.addCommand(createEnvPushCommand());
envCommand.addCommand(createEnvPullCommand());

program.addCommand(envCommand);
program.addCommand(createConfigCommand());

await program.parseAsync(process.argv);
