import { execSync } from "node:child_process";
import { Octokit } from "octokit";
import { UserError } from "./errors";

export interface PullRequestParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

export function getGitHubToken(): string {
  const envToken = process.env.GITHUB_TOKEN;

  if (envToken) {
    return envToken;
  }

  try {
    return execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new UserError(
      "No GitHub token found. Set GITHUB_TOKEN env var or install GitHub CLI (gh).",
    );
  }
}

export async function createPullRequest(
  params: PullRequestParams,
): Promise<{ url: string; number: number }> {
  const octokit = new Octokit({
    auth: getGitHubToken(),
  });

  const response = await octokit.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
  });

  return {
    url: response.data.html_url,
    number: response.data.number,
  };
}
