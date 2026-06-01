import type {
  Result,
  SourceResult,
  StackProfile,
  ToolRecord,
} from "../../types/index.js";
import { ok } from "../../types/index.js";
import { TOOL_CATEGORIES } from "../../types/index.js";
import { fetchNpm } from "../../sources/npm.js";
import { fetchGitHubSources } from "../../sources/github.js";
import { fetchSmithery, getSmitheryToken } from "../../sources/smithery.js";
import { fetchWebSearch, getTavilyKey, buildQueries } from "../../sources/websearch.js";

export interface SearchOutput {
  tools: ToolRecord[];
  /** Sources that were queried and their status. */
  sources: Array<{ source: string; count: number; error?: string }>;
  webSearchUnavailable: boolean;
}

const REQUIRED_FIELDS: Array<keyof ToolRecord> = [
  "name",
  "description",
  "source",
  "url",
  "install_command",
  "category",
];

const VALID_CATEGORIES = new Set<string>(TOOL_CATEGORIES);

/** Discard any record missing a required field or with an unknown category. */
function isValidRecord(t: ToolRecord): boolean {
  for (const field of REQUIRED_FIELDS) {
    const value = t[field];
    if (value === undefined || value === null || value === "") {
      return false;
    }
  }
  return VALID_CATEGORIES.has(t.category);
}

/**
 * Query all enabled sources concurrently and aggregate valid Tool_Records.
 *
 * Primary sources (always on, auth-free): npm registry, GitHub search.
 * Optional sources (require a key): Smithery registry, Tavily web search.
 * Never throws.
 */
export async function searchTools(stack: StackProfile): Promise<Result<SearchOutput>> {
  const connectors: Array<Promise<SourceResult>> = [
    fetchNpm(stack),
    fetchGitHubSources(stack),
  ];

  if (getSmitheryToken() !== null) {
    connectors.push(fetchSmithery(stack));
  }

  const tavilyKey = getTavilyKey();
  const webSearchEnabled = tavilyKey !== null && buildQueries(stack).length > 0;
  if (webSearchEnabled) {
    connectors.push(fetchWebSearch(stack));
  }

  const settled = await Promise.allSettled(connectors);

  const tools: ToolRecord[] = [];
  const sources: SearchOutput["sources"] = [];
  let webSearchUnavailable = false;

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      const result = outcome.value;
      const valid = result.tools.filter(isValidRecord);
      tools.push(...valid);
      sources.push({ source: result.source, count: valid.length, error: result.error });
      if (result.source === "tavily" && result.error) {
        webSearchUnavailable = true;
      }
    } else {
      sources.push({ source: "unknown", count: 0, error: String(outcome.reason) });
    }
  }

  if (webSearchEnabled && !sources.some((s) => s.source === "tavily")) {
    webSearchUnavailable = true;
  }

  // Deduplicate by name+source.
  const seen = new Set<string>();
  const deduped = tools.filter((t) => {
    const key = `${t.source}::${t.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return ok({ tools: deduped, sources, webSearchUnavailable });
}
