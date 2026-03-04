import fs from "node:fs";
import path from "node:path";
import { ConventionalChangelog } from "conventional-changelog";

function normalizeGeneratedEntry(markdown: string): string {
  return markdown
    .replace(/^# Changelog\s*/i, "")
    .trim();
}

export async function generateChangelog(newVersion: string, cwd = process.cwd()): Promise<string> {
  const generator = new ConventionalChangelog(cwd);
  const stream = generator
    .loadPreset("conventionalcommits")
    .options({ releaseCount: 1 })
    .tags({ prefix: "v" })
    .context({ version: newVersion })
    .writeStream();

  const chunks: string[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
  }

  const markdown = normalizeGeneratedEntry(chunks.join("").trim());

  if (markdown.length > 0) {
    return markdown;
  }

  const date = new Date().toISOString().slice(0, 10);
  return `## v${newVersion} (${date})\n\n### Other Changes\n\n- No user-facing changes.\n`;
}

export function updateChangelogFile(newChangelog: string, cwd = process.cwd()): void {
  const changelogPath = path.join(cwd, "CHANGELOG.md");
  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";
  const entry = `${normalizeGeneratedEntry(newChangelog)}\n`;

  if (!existing) {
    fs.writeFileSync(changelogPath, `# Changelog\n\n${entry}`, "utf8");
    return;
  }

  if (existing.startsWith("# Changelog")) {
    const rest = existing.replace(/^# Changelog\s*/i, "").trimStart();
    fs.writeFileSync(
      changelogPath,
      `# Changelog\n\n${entry}\n${rest}`.replace(/\n{3,}/g, "\n\n"),
      "utf8",
    );
    return;
  }

  fs.writeFileSync(changelogPath, `${entry}\n${existing}`.replace(/\n{3,}/g, "\n\n"), "utf8");
}
