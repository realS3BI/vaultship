import { Command } from "commander";
import ora from "ora";
import { generateChangelog, updateChangelogFile } from "@lib/changelog";
import { UserError } from "@lib/errors";
import { createPullRequest } from "@lib/github";
import {
  checkoutBranch,
  commitAll,
  createBranch,
  getCurrentBranch,
  getRemoteUrl,
  isWorkingDirectoryClean,
  pullBranch,
  pushBranch,
} from "@lib/git";
import { info, success } from "@lib/output";
import { getProjectConfig } from "@lib/project-config";
import {
  bumpVersion,
  readRootVersion,
  updateAllPackageJsonVersions,
} from "@lib/version";
import { wrapCommand } from "../command-utils";

type ReleaseType = "patch" | "minor" | "major";

async function runRelease(options: { minor?: boolean; major?: boolean }): Promise<void> {
  getProjectConfig();

  if (options.minor && options.major) {
    throw new UserError("Choose only one of --minor or --major.");
  }

  if (getCurrentBranch() !== "main") {
    throw new UserError("You must be on the main branch to create a release.");
  }

  if (!isWorkingDirectoryClean()) {
    throw new UserError("Working directory is not clean. Commit or stash changes first.");
  }

  const releaseType: ReleaseType = options.major ? "major" : options.minor ? "minor" : "patch";
  const pullSpinner = ora("Pulling latest changes from origin/main").start();
  pullBranch("main");
  pullSpinner.succeed("Repository is up to date");

  const currentVersion = readRootVersion();
  const newVersion = bumpVersion(currentVersion, releaseType);
  const changelog = await generateChangelog(newVersion);
  updateChangelogFile(changelog);
  updateAllPackageJsonVersions(newVersion);

  const branchName = `release/v${newVersion}`;
  const title = `chore(release): v${newVersion}`;

  const branchSpinner = ora(`Creating ${branchName}`).start();
  checkoutBranch("main");
  createBranch(branchName);
  branchSpinner.succeed(`Created ${branchName}`);

  const commitSpinner = ora("Committing release changes").start();
  commitAll(title);
  commitSpinner.succeed("Release changes committed");

  const pushSpinner = ora(`Pushing ${branchName}`).start();
  pushBranch(branchName);
  pushSpinner.succeed(`Pushed ${branchName}`);

  const remote = getRemoteUrl();
  const prSpinner = ora("Creating release pull request").start();

  try {
    const pr = await createPullRequest({
      owner: remote.owner,
      repo: remote.repo,
      title,
      body: changelog,
      head: branchName,
      base: "main",
    });

    prSpinner.succeed("Release pull request created");
    checkoutBranch("main");

    success("Release PR created!");
    info(`Version: v${newVersion}`);
    info(`PR: ${pr.url}`);
    info("Review and merge the PR to trigger the release.");
  } catch (error) {
    prSpinner.fail("Failed to create release pull request");
    checkoutBranch("main");
    throw error;
  }
}

export function createReleaseCommand(): Command {
  return new Command("release")
    .description("Create a release PR from main")
    .option("--minor", "Create a minor release")
    .option("--major", "Create a major release")
    .action(wrapCommand(runRelease));
}
