import { execSync } from "node:child_process";
import { UserError } from "./errors";

function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(arg)) {
    return arg;
  }

  return JSON.stringify(arg);
}

function runGitCommand(args: string[]): string {
  try {
    return execSync(`git ${args.map(quoteArg).join(" ")}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("not a git repository")) {
      throw new UserError("Current directory is not a git repository.");
    }

    if (message.includes("'git' is not recognized") || message.includes("not found")) {
      throw new UserError("Git is required but was not found in PATH.");
    }

    throw new UserError(`Git command failed: git ${args.join(" ")}`);
  }
}

export function getCurrentBranch(): string {
  return runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function isWorkingDirectoryClean(): boolean {
  return runGitCommand(["status", "--porcelain"]).length === 0;
}

export function getRemoteUrl(): { owner: string; repo: string } {
  const remote = runGitCommand(["remote", "get-url", "origin"]);
  const match = remote.match(
    /(?:github\.com[:/])(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/,
  );

  if (!match?.groups?.owner || !match.groups.repo) {
    throw new UserError("Could not parse GitHub owner and repo from origin remote.");
  }

  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
  };
}

export function createAndPushBranch(branchName: string): void {
  runGitCommand(["checkout", "-b", branchName]);
  runGitCommand(["push", "-u", "origin", branchName]);
}

export function createBranch(branchName: string): void {
  runGitCommand(["checkout", "-b", branchName]);
}

export function pushBranch(branchName: string): void {
  runGitCommand(["push", "-u", "origin", branchName]);
}

export function commitAll(message: string): void {
  runGitCommand(["add", "-A"]);
  runGitCommand(["commit", "-m", message]);
}

export function getCurrentTags(): string[] {
  const output = runGitCommand(["tag", "--list", "v*"]);
  return output
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort();
}

export function checkoutBranch(branchName: string): void {
  runGitCommand(["checkout", branchName]);
}

export function pullBranch(branchName: string): void {
  runGitCommand(["pull", "origin", branchName]);
}
