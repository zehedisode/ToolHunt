import type { SourceResult, StackProfile, ToolCategory, ToolRecord } from "../types/index.js";
import { fetchJson } from "./httpClient.js";

const NPM_SEARCH = "https://registry.npmjs.org/-/v1/search";
// Candidates fetched per category. With 9 categories this yields a pool of up
// to ~225 npm packages before ranking down to the final recommendations.
const PER_QUERY = 25;

interface NpmPackage {
  name: string;
  description?: string;
  date?: string;
  links?: { npm?: string; homepage?: string; repository?: string };
}

interface NpmObject {
  package: NpmPackage;
  score?: { final?: number; detail?: { popularity?: number } };
}

interface NpmSearchResponse {
  objects?: NpmObject[];
}

/**
 * Category-specific search terms. Each query maps its results to a single
 * category, so categorization is exact rather than guessed.
 */
const CATEGORY_QUERIES: Array<{ category: ToolCategory; base: string }> = [
  { category: "MCP Tools", base: "mcp server model context protocol" },
  { category: "Skills", base: "ai agent tool function calling" },
  { category: "Agents", base: "ai agent framework autonomous" },
  { category: "Memory", base: "vector database embeddings rag" },
  { category: "Orchestrators", base: "llm orchestration langchain workflow" },
  { category: "Context Windows", base: "llm context window token management" },
  { category: "Prompt Templates", base: "prompt template engineering" },
  { category: "Logging and Telemetry", base: "llm observability tracing telemetry" },
  { category: "API Integrations", base: "ai llm api sdk client" },
];

/**
 * Keyword gate per category: a result is only accepted into a category if its
 * name or description matches at least one of these. Prevents framework-named
 * but category-irrelevant packages (e.g. "@storybook/nextjs") from polluting
 * unrelated categories.
 */
const CATEGORY_KEYWORDS: Record<ToolCategory, string[]> = {
  "MCP Tools": ["mcp", "model context protocol"],
  Skills: ["agent", "tool", "function call", "skill", "capability"],
  Agents: ["agent", "autonomous", "assistant", "swarm"],
  Memory: ["vector", "embedding", "rag", "memory", "pinecone", "weaviate", "qdrant", "chroma", "store"],
  Orchestrators: ["orchestr", "langchain", "langgraph", "crew", "autogen", "workflow", "graph", "pipeline", "chain"],
  "Context Windows": ["context", "token", "chunk", "summar", "window", "truncat"],
  "Prompt Templates": ["prompt", "template", "few-shot", "system message"],
  "Logging and Telemetry": ["observ", "telemetry", "tracing", "logging", "monitor", "langfuse", "langsmith", "helicone", "otel"],
  "API Integrations": ["api", "sdk", "client", "integration", "openai", "anthropic", "llm", "ai"],
};

function matchesCategory(name: string, description: string, category: ToolCategory): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return CATEGORY_KEYWORDS[category].some((k) => text.includes(k));
}

/**
 * Pure classification used by the npm source and exercised directly in tests.
 * Returns a ToolRecord skeleton if the package belongs in the category, or null
 * if it is noise (scaffolding) or fails the category keyword gate.
 */
export function classifyNpmPackage(
  name: string,
  description: string,
  category: ToolCategory,
): ToolRecord | null {
  if (!name) {
    return null;
  }
  if (isNoise(name, description)) {
    return null;
  }
  if (!matchesCategory(name, description, category)) {
    return null;
  }
  return {
    name,
    description: (description || name).slice(0, 280),
    source: "npm",
    url: `https://www.npmjs.com/package/${name}`,
    install_command: `npm install ${name}`,
    category,
    relevance_score: 0,
  };
}

function toRecord(obj: NpmObject, category: ToolCategory): ToolRecord | null {
  const pkg = obj.package;
  if (!pkg?.name) {
    return null;
  }
  const description = pkg.description ?? "";
  if (isNoise(pkg.name, description)) {
    return null;
  }
  // Gate: only accept results that actually relate to the category.
  if (!matchesCategory(pkg.name, description, category)) {
    return null;
  }
  const url = pkg.links?.repository ?? pkg.links?.homepage ?? pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`;
  const popularity = obj.score?.detail?.popularity ?? 0;
  return {
    name: pkg.name,
    description: (pkg.description ?? pkg.name).slice(0, 280),
    source: "npm",
    url,
    install_command: `npm install ${pkg.name}`,
    category,
    relevance_score: 0,
    popularity,
    last_updated: pkg.date,
  };
}

/**
 * Filter out project scaffolding / boilerplate that shows up in searches but
 * isn't an installable tool (e.g. "create-next-app", "*-starter-template").
 */
function isNoise(name: string, description: string): boolean {
  const n = name.toLowerCase();
  const text = `${n} ${description.toLowerCase()}`;
  if (/^create-|create-.*-app|-cli-template/.test(n)) {
    return true;
  }
  return /\b(boilerplate|starter kit|starter template|scaffold(ing)?|template repo|example app|demo app)\b/.test(text);
}

async function runQuery(category: ToolCategory, base: string): Promise<ToolRecord[]> {
  const url = `${NPM_SEARCH}?text=${encodeURIComponent(base)}&size=${PER_QUERY}`;
  const res = await fetchJson<NpmSearchResponse>(url, { timeoutMs: 5000 });
  if (!res.ok) {
    return [];
  }
  const records: ToolRecord[] = [];
  for (const obj of res.data.objects ?? []) {
    const record = toRecord(obj, category);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

/**
 * Query the npm registry once per category and aggregate. Auth-free, returns
 * clean structured data. Never throws.
 */
export async function fetchNpm(_stack: StackProfile): Promise<SourceResult> {
  try {
    const perCategory = await Promise.all(
      CATEGORY_QUERIES.map((q) => runQuery(q.category, q.base)),
    );
    const tools: ToolRecord[] = [];
    const seen = new Set<string>();
    for (const list of perCategory) {
      for (const tool of list) {
        if (!seen.has(tool.name.toLowerCase())) {
          seen.add(tool.name.toLowerCase());
          tools.push(tool);
        }
      }
    }
    if (tools.length === 0) {
      return { source: "npm", tools: [], error: "npm registry returned no results" };
    }
    return { source: "npm", tools };
  } catch (error) {
    return {
      source: "npm",
      tools: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
