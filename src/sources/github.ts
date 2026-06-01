import type { SourceResult, StackProfile, ToolCategory, ToolRecord } from "../types/index.js";
import { fetchJson } from "./httpClient.js";

const GITHUB_SEARCH = "https://api.github.com/search/repositories";
// Top-starred repos fetched per category query.
const PER_QUERY = 15;

interface GitHubRepo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  language: string | null;
}

interface GitHubSearchResponse {
  items?: GitHubRepo[];
}

const CATEGORY_QUERIES: Array<{ category: ToolCategory; q: string }> = [
  { category: "MCP Tools", q: "mcp server model context protocol" },
  { category: "Agents", q: "ai agent framework autonomous" },
  { category: "Memory", q: "vector database memory llm rag" },
  { category: "Orchestrators", q: "llm orchestration agent workflow" },
  { category: "Logging and Telemetry", q: "llm observability tracing" },
  { category: "Prompt Templates", q: "prompt engineering templates" },
];

/** Keyword gate per category (mirrors the npm source) to keep results on-topic. */
const CATEGORY_KEYWORDS: Partial<Record<ToolCategory, string[]>> = {
  "MCP Tools": ["mcp", "model context protocol"],
  Agents: ["agent", "autonomous", "assistant", "swarm"],
  Memory: ["vector", "embedding", "rag", "memory", "store"],
  Orchestrators: ["orchestr", "langchain", "langgraph", "crew", "autogen", "workflow", "graph", "pipeline"],
  "Logging and Telemetry": ["observ", "telemetry", "tracing", "logging", "monitor", "langfuse", "langsmith", "otel"],
  "Prompt Templates": ["prompt", "template"],
};

function matchesCategory(name: string, description: string, category: ToolCategory): boolean {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) {
    return true;
  }
  const text = `${name} ${description}`.toLowerCase();
  return keywords.some((k) => text.includes(k));
}

/** Returns the GitHub token from env, or null if unset. Optional but lifts rate limits. */
export function getGitHubToken(): string | null {
  const token = process.env.GITHUB_TOKEN;
  return token && token.trim() !== "" ? token.trim() : null;
}

function toRecord(repo: GitHubRepo, category: ToolCategory): ToolRecord | null {
  if (!repo.full_name || !repo.html_url) {
    return null;
  }
  const description = repo.description ?? "";
  if (!matchesCategory(repo.full_name, description, category)) {
    return null;
  }
  return {
    name: repo.full_name,
    description: (repo.description ?? repo.full_name).slice(0, 280),
    source: "github",
    url: repo.html_url,
    install_command: `git clone ${repo.html_url}.git`,
    category,
    relevance_score: 0,
    stars: repo.stargazers_count,
    last_updated: repo.pushed_at,
  };
}

function buildQuery(base: string, stack: StackProfile): string {
  // Use GitHub's precise language qualifier; do not inject framework names as
  // free text (it pulls in framework repos unrelated to the category).
  if (stack.language && stack.language !== "other") {
    return `${base} language:${stack.language}`.trim();
  }
  return base;
}

async function runQuery(
  category: ToolCategory,
  base: string,
  stack: StackProfile,
  headers: Record<string, string>,
): Promise<ToolRecord[]> {
  const q = buildQuery(base, stack);
  const url = `${GITHUB_SEARCH}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_QUERY}`;
  const res = await fetchJson<GitHubSearchResponse>(url, { timeoutMs: 5000, headers });
  if (!res.ok) {
    return [];
  }
  const records: ToolRecord[] = [];
  for (const repo of res.data.items ?? []) {
    const record = toRecord(repo, category);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

/**
 * Search GitHub repositories per category, capturing stars and recency.
 * Runs queries sequentially to respect the low unauthenticated rate limit
 * (10 req/min); a token raises this substantially. Never throws.
 */
export async function fetchGitHubSources(stack: StackProfile): Promise<SourceResult> {
  const token = getGitHubToken();
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Without a token GitHub allows ~10 search req/min; cap how many queries we run.
  const queries = token ? CATEGORY_QUERIES : CATEGORY_QUERIES.slice(0, 3);

  try {
    const tools: ToolRecord[] = [];
    const seen = new Set<string>();
    for (const { category, q } of queries) {
      const list = await runQuery(category, q, stack, headers);
      for (const tool of list) {
        if (!seen.has(tool.name.toLowerCase())) {
          seen.add(tool.name.toLowerCase());
          tools.push(tool);
        }
      }
    }
    if (tools.length === 0) {
      return { source: "github", tools: [], error: "GitHub search returned no results (possibly rate-limited)" };
    }
    return { source: "github", tools };
  } catch (error) {
    return {
      source: "github",
      tools: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
