import os from "node:os";
import { UserError } from "./errors";

interface PocketBaseRecord {
  id: string;
  projectId: string;
  encryptedEnv: string;
}

interface ListResponse {
  items: PocketBaseRecord[];
}

export interface PocketBaseClient {
  pushEnv(projectId: string, encryptedEnv: string): Promise<void>;
  pullEnv(projectId: string): Promise<string | null>;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

async function listRecords(
  apiUrl: string,
  apiKey: string,
  projectId: string,
): Promise<PocketBaseRecord[]> {
  const url = new URL(`${normalizeApiUrl(apiUrl)}/api/collections/envs/records`);
  url.searchParams.set("filter", `(projectId='${projectId}')`);

  const response = await fetch(url, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new UserError("Authentication failed. Check your API key with 'vaultship config get apiKey'.");
    }

    throw new UserError(`PocketBase request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as ListResponse;
  return data.items ?? [];
}

export function createPocketBaseClient(apiUrl: string, apiKey: string): PocketBaseClient {
  return {
    async pushEnv(projectId, encryptedEnv) {
      const records = await listRecords(apiUrl, apiKey, projectId);
      const payload = JSON.stringify({
        projectId,
        encryptedEnv,
        updatedBy: os.hostname(),
      });

      if (records.length > 0) {
        const response = await fetch(
          `${normalizeApiUrl(apiUrl)}/api/collections/envs/records/${records[0].id}`,
          {
            method: "PATCH",
            headers: buildHeaders(apiKey),
            body: payload,
          },
        );

        if (!response.ok) {
          throw new UserError(`Failed to update environment record (status ${response.status}).`);
        }

        return;
      }

      const response = await fetch(`${normalizeApiUrl(apiUrl)}/api/collections/envs/records`, {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: payload,
      });

      if (!response.ok) {
        throw new UserError(`Failed to create environment record (status ${response.status}).`);
      }
    },

    async pullEnv(projectId) {
      const records = await listRecords(apiUrl, apiKey, projectId);
      return records[0]?.encryptedEnv ?? null;
    },
  };
}
