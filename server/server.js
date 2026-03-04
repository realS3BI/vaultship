import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";

const port = Number(process.env.PORT ?? "8090");
const dbPath = process.env.DB_PATH ?? "/data/vaultship.db";
const apiKey = process.env.VAULTSHIP_API_KEY ?? "";

if (!apiKey) {
  throw new Error("Missing VAULTSHIP_API_KEY. Set it in the environment or let entrypoint.sh create one.");
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS envs (
    project_id TEXT PRIMARY KEY,
    encrypted_env TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL
  );
`);

const findEnvByProjectId = db.prepare(`
  SELECT
    project_id AS projectId,
    encrypted_env AS encryptedEnv,
    updated_by AS updatedBy,
    updated_at AS updatedAt
  FROM envs
  WHERE project_id = ?
`);

const upsertEnv = db.prepare(`
  INSERT INTO envs (project_id, encrypted_env, updated_by, updated_at)
  VALUES (@projectId, @encryptedEnv, @updatedBy, @updatedAt)
  ON CONFLICT(project_id) DO UPDATE SET
    encrypted_env = excluded.encrypted_env,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
`);

function getSuppliedApiKey(request) {
  const authHeader = request.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return request.get("X-API-Key")?.trim() ?? "";
}

function isAuthorized(request) {
  const suppliedKey = getSuppliedApiKey(request);

  if (!suppliedKey) {
    return false;
  }

  const expectedBuffer = Buffer.from(apiKey, "utf8");
  const suppliedBuffer = Buffer.from(suppliedKey, "utf8");

  if (expectedBuffer.length !== suppliedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function isValidProjectId(projectId) {
  return typeof projectId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(projectId);
}

function requireApiKey(request, response, next) {
  if (!isAuthorized(request)) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/v1/env/:projectId", requireApiKey, (request, response) => {
  const { projectId } = request.params;

  if (!isValidProjectId(projectId)) {
    response.status(400).json({ error: "Invalid projectId." });
    return;
  }

  const record = findEnvByProjectId.get(projectId);

  if (!record) {
    response.status(404).json({ error: "No environment variables found for this project." });
    return;
  }

  response.json(record);
});

app.put("/v1/env/:projectId", requireApiKey, (request, response) => {
  const { projectId } = request.params;

  if (!isValidProjectId(projectId)) {
    response.status(400).json({ error: "Invalid projectId." });
    return;
  }

  const { encryptedEnv, updatedBy } = request.body ?? {};

  if (typeof encryptedEnv !== "string" || encryptedEnv.length === 0) {
    response.status(400).json({ error: "'encryptedEnv' must be a non-empty string." });
    return;
  }

  if (encryptedEnv.length > 1_000_000_000) {
    response.status(400).json({ error: "'encryptedEnv' is too large (max 1GB)." });
    return;
  }

  if (updatedBy !== undefined && (typeof updatedBy !== "string" || updatedBy.length > 255)) {
    response.status(400).json({ error: "'updatedBy' must be a string up to 255 chars." });
    return;
  }

  const updatedAt = new Date().toISOString();
  upsertEnv.run({
    projectId,
    encryptedEnv,
    updatedBy: typeof updatedBy === "string" ? updatedBy : null,
    updatedAt,
  });

  response.status(200).json({
    projectId,
    updatedAt,
  });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Vaultship server listening on port ${port}`);
  console.log(`Database: ${dbPath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
