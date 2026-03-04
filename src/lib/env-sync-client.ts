import os from "node:os";
import { UserError } from "./errors";

interface EnvRecord {
  projectId: string;
  encryptedEnv: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface EnvSyncClient {
  pushEnv(projectId: string, encryptedEnv: string): Promise<void>;
  pullEnv(projectId: string): Promise<string | null>;
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function throwAuthError(): never {
  throw new UserError("Authentication failed. Check your API key with 'vaultship config get apiKey'.");
}

export function createEnvSyncClient(apiUrl: string, apiKey: string): EnvSyncClient {
  const baseUrl = normalizeApiUrl(apiUrl);

  return {
    async pushEnv(projectId, encryptedEnv) {
      const response = await fetch(`${baseUrl}/v1/env/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          encryptedEnv,
          updatedBy: os.hostname(),
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throwAuthError();
      }

      if (!response.ok) {
        const data = (await parseJson(response)) as { error?: string } | null;
        throw new UserError(data?.error ?? `Vaultship server request failed with status ${response.status}.`);
      }
    },

    async pullEnv(projectId) {
      const response = await fetch(`${baseUrl}/v1/env/${encodeURIComponent(projectId)}`, {
        headers: buildHeaders(apiKey),
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        throwAuthError();
      }

      if (!response.ok) {
        const data = (await parseJson(response)) as { error?: string } | null;
        throw new UserError(data?.error ?? `Vaultship server request failed with status ${response.status}.`);
      }

      const data = (await response.json()) as EnvRecord;
      return data.encryptedEnv ?? null;
    },
  };
}
