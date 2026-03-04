import { Command } from "commander";
import { createConfigCommand } from "./commands/config";
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
