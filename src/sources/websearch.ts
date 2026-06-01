import type { SourceResult, StackProfile, ToolRecord } from "../types/index.js";
import { postJson } from "./httpClient.js";

const TAVILY_URL = "https://api.tavily.com/search";
const WEB_SEARCH_TIMEOUT_MS = 10000;
const MAX_RESULTS_PER_QUERY = 5;

interface TavilyResult {
  title: string;
  url: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

/** Returns the trimmed Tavily API key, or null if unset/blank. */
export function getTavilyKey(): string | null {
  const key = process.env.TAVILY_API_KEY;
  if (key === undefined || key.trim() === "") {
    return null;
  }
  return key.trim();
}

/**
 * Build search queries from the non-empty Stack_Profile fields among
 * framework, language, and project_type. Returns [] when all three are empty.
 */
export function buildQueries(stack: StackProfile): string[] {
  const framework = stack.framework && stack.framework !== "none" ? stack.framework : "";
  const language = stack.language && stack.language !== "other" ? stack.language : "";
  const projectType = stack.project_type && stack.project_type !== "none" ? stack.project_type : "";

  if (framework === "" && language === "" && projectType === "") {
    return [];
  }

  const queries: string[] = [];
  if (framework !== "" || language !== "") {
    queries.push(`"MCP server" ${framework} ${language}`.trim().replace(/\s+/g, " "));
  }
  if (projectType !== "") {
    queries.push(`"AI agent tool" ${projectType}`.trim().replace(/\s+/g, " "));
  }
  if (stack.database === "none" && language !== "") {
    queries.push(`"vector database" ${language}`.trim().replace(/\s+/g, " "));
  }
  return queries;
}

async function runQuery(query: string, apiKey: string): Promise<ToolRecord[]> {
  const res = await postJson<TavilyResponse>(
    TAVILY_URL,
    {
      api_key: apiKey,
      query,
      max_results: MAX_RESULTS_PER_QUERY,
      search_depth: "basic",
    },
    { timeoutMs: WEB_SEARCH_TIMEOUT_MS },
  );

  if (!res.ok) {
    return [];
  }

  const results = res.data.results ?? [];
  return results.slice(0, MAX_RESULTS_PER_QUERY).map((r) => {
    const description = (r.content ?? r.title).slice(0, 280);
    return {
      name: r.title.slice(0, 120),
      description,
      source: "tavily",
      url: r.url,
      install_command: `# see ${r.url}`,
      category: "API Integrations",
      relevance_score: 0,
    } satisfies ToolRecord;
  });
}

/**
 * Query Tavily using stack-derived terms. Caller is responsible for only
 * invoking this when the key is set and at least one query is producible.
 * Aggregates results across queries; failures yield an empty set with an error.
 */
export async function fetchWebSearch(stack: StackProfile): Promise<SourceResult> {
  const apiKey = getTavilyKey();
  if (apiKey === null) {
    return { source: "tavily", tools: [], error: "Tavily API key not set" };
  }

  const queries = buildQueries(stack);
  if (queries.length === 0) {
    return { source: "tavily", tools: [], error: "No usable query terms in stack profile" };
  }

  try {
    const perQuery = await Promise.all(queries.map((q) => runQuery(q, apiKey)));
    const tools: ToolRecord[] = [];
    const seen = new Set<string>();
    for (const list of perQuery) {
      for (const tool of list) {
        const key = tool.url.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          tools.push(tool);
        }
      }
    }
    return { source: "tavily", tools };
  } catch (error) {
    return {
      source: "tavily",
      tools: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
