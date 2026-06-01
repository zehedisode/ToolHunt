export const TOOL_CATEGORIES = [
  "MCP Tools",
  "Skills",
  "Agents",
  "Memory",
  "Orchestrators",
  "Context Windows",
  "Prompt Templates",
  "Logging and Telemetry",
  "API Integrations",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface StackProfile {
  language: string;
  framework: string;
  database: string;
  infrastructure: string;
  existing_tools: string[];
  project_type: string;
  missing_categories: ToolCategory[];
}

export interface ToolRecord {
  name: string;
  description: string;
  source: string;
  url: string;
  install_command: string;
  category: ToolCategory;
  relevance_score: number;
  stars?: number;
  last_updated?: string;
}

export interface RecommendationGroup {
  category: ToolCategory;
  tools: ToolRecord[];
}

export interface StatusResponse {
  health: "healthy" | "unhealthy";
  mcp: "connected" | "disconnected";
}
