import fs from "node:fs";
import path from "node:path";
import { getWorkspacePackagePaths, isMonorepo } from "./monorepo";
import { UserError } from "./errors";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

interface PackageJson {
  version?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPackageJson(filePath: string): PackageJson {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as PackageJson;
}

function writePackageJson(filePath: string, packageJson: PackageJson): void {
  fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

export function bumpVersion(
  currentVersion: string,
  type: "patch" | "minor" | "major",
): string {
  const match = currentVersion.match(SEMVER_PATTERN);

  if (!match) {
    throw new UserError(`Invalid semver version: ${currentVersion}`);
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number.parseInt(majorRaw, 10);
  let minor = Number.parseInt(minorRaw, 10);
  let patch = Number.parseInt(patchRaw, 10);

  if (type === "patch") {
    patch += 1;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

export function readRootVersion(cwd = process.cwd()): string {
  const packageJsonPath = path.join(cwd, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new UserError("No package.json found in current directory.");
  }

  const version = readPackageJson(packageJsonPath).version;

  if (!version) {
    throw new UserError("No version field found in package.json.");
  }

  return version;
}

export function updateAllPackageJsonVersions(
  newVersion: string,
  cwd = process.cwd(),
): string[] {
  const packageJsonFiles = new Set<string>([path.join(cwd, "package.json")]);

  if (isMonorepo(cwd)) {
    for (const workspacePath of getWorkspacePackagePaths(cwd)) {
      packageJsonFiles.add(path.join(workspacePath, "package.json"));
    }
  }

  const updatedFiles: string[] = [];

  for (const packageJsonPath of packageJsonFiles) {
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = readPackageJson(packageJsonPath);
    packageJson.version = newVersion;
    writePackageJson(packageJsonPath, packageJson);
    updatedFiles.push(path.relative(cwd, packageJsonPath) || "package.json");
  }

  return updatedFiles.sort();
}

export function getPackageJson(cwd = process.cwd()): PackageJson {
  return readPackageJson(path.join(cwd, "package.json"));
}

export function savePackageJson(packageJson: PackageJson, cwd = process.cwd()): void {
  writePackageJson(path.join(cwd, "package.json"), packageJson);
}
