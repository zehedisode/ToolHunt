import type { SourceResult, StackProfile, ToolRecord } from "../types/index.js";
import { fetchJson } from "./httpClient.js";

const SMITHERY_API = "https://registry.smithery.ai/servers";
const PAGE_SIZE = 15;

interface SmitheryServer {
  qualifiedName?: string;
  displayName?: string;
  description?: string;
  homepage?: string;
  useCount?: number;
  createdAt?: string;
}

interface SmitheryResponse {
  servers?: SmitheryServer[];
}

/** Returns the Smithery API token from env, or null if unset. */
export function getSmitheryToken(): string | null {
  const token = process.env.SMITHERY_API_KEY;
  return token && token.trim() !== "" ? token.trim() : null;
}

function toRecord(server: SmitheryServer): ToolRecord | null {
  const qualified = server.qualifiedName;
  if (!qualified) {
    return null;
  }
  const name = server.displayName ?? qualified.split("/").pop() ?? qualified;
  return {
    name,
    description: (server.description ?? name).slice(0, 280),
    source: "smithery.ai",
    url: server.homepage ?? `https://smithery.ai/server/${qualified}`,
    install_command: `npx -y @smithery/cli install ${qualified}`,
    category: "MCP Tools",
    relevance_score: 0,
    last_updated: server.createdAt,
  };
}

function buildQuery(stack: StackProfile): string {
  const parts = [stack.framework, stack.language, stack.project_type].filter(
    (v) => v && v !== "none" && v !== "other",
  );
  return parts.join(" ");
}

/**
 * Query the official Smithery registry API. Requires SMITHERY_API_KEY; when the
 * key is absent the connector is skipped (returns an empty set with an error).
 * Never throws.
 */
export async function fetchSmithery(stack: StackProfile): Promise<SourceResult> {
  const token = getSmitheryToken();
  if (token === null) {
    return { source: "smithery.ai", tools: [], error: "Smithery API key not set" };
  }

  const query = buildQuery(stack);
  const url = `${SMITHERY_API}?q=${encodeURIComponent(query || "mcp")}&pageSize=${PAGE_SIZE}`;
  const res = await fetchJson<SmitheryResponse>(url, {
    timeoutMs: 5000,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { source: "smithery.ai", tools: [], error: res.error };
  }

  const tools: ToolRecord[] = [];
  for (const server of res.data.servers ?? []) {
    const record = toRecord(server);
    if (record) {
      tools.push(record);
    }
  }
  return { source: "smithery.ai", tools };
}
