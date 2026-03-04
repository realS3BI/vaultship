import chalk from "chalk";
import { UserError, toErrorMessage } from "./errors";

export function success(message: string): void {
  console.log(`${chalk.green("✅")} ${message}`);
}

export function warning(message: string): void {
  console.log(`${chalk.yellow("⚠️")} ${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function maskSecret(value: string, visibleChars = 8): string {
  if (!value) {
    return "";
  }

  if (value.length <= visibleChars) {
    return `${value}...`;
  }

  return `${value.slice(0, visibleChars)}...`;
}

export function printCliError(error: unknown): void {
  const verbose = process.argv.includes("--verbose");

  if (!(error instanceof UserError) && verbose && error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }

  console.error(`${chalk.red("❌")} ${toErrorMessage(error)}`);
}
