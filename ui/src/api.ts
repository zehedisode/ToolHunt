import type {
  RecommendationGroup,
  StackProfile,
  StatusResponse,
  ToolRecord,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function getStatus(): Promise<StatusResponse> {
  return json<StatusResponse>(await fetch("/api/status"));
}

export async function getRecommendations(): Promise<{
  stack: StackProfile | null;
  recommendations: RecommendationGroup[];
}> {
  return json(await fetch("/api/recommendations"));
}

export async function getTools(): Promise<{ tools: ToolRecord[] }> {
  return json(await fetch("/api/tools"));
}

export async function scan(projectPath?: string): Promise<{
  triggered: boolean;
  stack?: StackProfile;
  recommendationCount?: number;
  webSearchUnavailable?: boolean;
  error?: string;
}> {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_path: projectPath }),
  });
  return res.json();
}

export async function install(tool: ToolRecord, projectPath?: string): Promise<{
  outcome: "succeeded" | "failed";
  error?: string;
  details?: unknown;
}> {
  // npm packages update package.json; MCP registry servers update mcp.json.
  const configType =
    tool.source === "smithery.ai"
      ? "mcp_json"
      : tool.source === "npm"
        ? "package_json"
        : "manual";
  const res = await fetch("/api/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool_name: tool.name,
      install_command: tool.install_command,
      config_type: configType,
      agent: "kiro",
      project_path: projectPath,
    }),
  });
  return res.json();
}
