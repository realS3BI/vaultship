import fs from "node:fs";

export function ensureFileContainsLine(filePath: string, line: string): boolean {
  const normalizedLine = line.trim();
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const lines = existing.split(/\r?\n/).map((entry) => entry.trim());

  if (lines.includes(normalizedLine)) {
    return false;
  }

  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(filePath, `${prefix}${line}\n`, "utf8");
  return true;
}
