/**
 * Shared TypeScript types for ToolHunt.
 */

/** The nine tool categories ToolHunt classifies discovered tools into. */
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

export type Language = "typescript" | "python" | "rust" | "go" | "other";

/** Structured description of a detected project. */
export interface StackProfile {
  language: Language;
  framework: string;
  database: string;
  infrastructure: string;
  existing_tools: string[];
  project_type: string;
  missing_categories: ToolCategory[];
}

/** A single discovered tool. */
export interface ToolRecord {
  name: string;
  description: string;
  source: string;
  url: string;
  install_command: string;
  category: ToolCategory;
  relevance_score: number;
  /** Optional GitHub star count, used as the popularity input when present. */
  stars?: number;
  /** Optional normalized popularity in [0,1] (e.g. npm popularity score). */
  popularity?: number;
  /** Optional ISO date of last update, used for recency scoring. */
  last_updated?: string;
}

/** Recommendations grouped by category. */
export interface RecommendationGroup {
  category: ToolCategory;
  tools: ToolRecord[];
}

/** Discriminated result type returned by all async operations. */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}

/** Raw data collected by the project scanner before stack detection. */
export interface RawProjectData {
  projectPath: string;
  manifests: Record<string, unknown>;
  /** Raw text of manifest files that were read but not parsed as JSON. */
  manifestText: Record<string, string>;
  readmeExcerpt: string;
  envKeys: string[];
  directories: string[];
  files: string[];
}

/** Result of a single source connector query. */
export interface SourceResult {
  source: string;
  tools: ToolRecord[];
  /** Set when the source failed; tools will be empty. */
  error?: string;
}

export interface InstallRequest {
  tool_name: string;
  install_command: string;
  project_path: string;
  config_type: "mcp_json" | "package_json" | "env" | "manual";
  /** Which agent's MCP config to update when config_type is mcp_json. */
  agent?: "kiro" | "claude" | "cursor";
}

export interface InstallOutcome {
  tool_name: string;
  installed: boolean;
  config_updated: boolean;
  logs: string;
}
