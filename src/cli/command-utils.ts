import { printCliError } from "../lib/output";

export function wrapCommand(
  action: (...args: any[]) => Promise<void> | void,
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      await action(...args);
    } catch (error) {
      printCliError(error);
      process.exitCode = 1;
    }
  };
}
