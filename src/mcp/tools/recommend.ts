import type {
  RecommendationGroup,
  Result,
  StackProfile,
  ToolCategory,
  ToolRecord,
} from "../../types/index.js";
import { ok } from "../../types/index.js";

const MAX_RECOMMENDATIONS = 10;

// Weights are non-negative so the score is monotonically non-decreasing in each
// normalized input (stack match, category fit, popularity, recency). Category
// fit dominates: matching the project's needs matters more than a keyword hit.
const W_STACK = 25;
const W_CATEGORY = 45;
const W_POPULARITY = 18;
const W_RECENCY = 12;

/**
 * How important each category is for a given project type. Drives meaningful
 * differentiation: an ai-agent project should rank Orchestrators/Memory above
 * Logging, while a web-app ranks API Integrations/Logging higher. Values are in
 * [0,1]. Unlisted project types fall back to DEFAULT_IMPORTANCE.
 */
const DEFAULT_IMPORTANCE = 0.6;
const CATEGORY_IMPORTANCE: Record<string, Partial<Record<ToolCategory, number>>> = {
  "ai-agent": {
    Orchestrators: 1.0,
    Agents: 1.0,
    Memory: 0.9,
    "MCP Tools": 0.85,
    Skills: 0.8,
    "Prompt Templates": 0.75,
    "Context Windows": 0.7,
    "Logging and Telemetry": 0.6,
    "API Integrations": 0.55,
  },
  "web-app": {
    "API Integrations": 1.0,
    "Logging and Telemetry": 0.85,
    "MCP Tools": 0.7,
    Memory: 0.65,
    Agents: 0.5,
    Skills: 0.5,
    Orchestrators: 0.45,
    "Prompt Templates": 0.45,
    "Context Windows": 0.4,
  },
  api: {
    "API Integrations": 1.0,
    "Logging and Telemetry": 0.9,
    "MCP Tools": 0.75,
    Memory: 0.6,
    Agents: 0.5,
    Orchestrators: 0.5,
    Skills: 0.45,
    "Prompt Templates": 0.4,
    "Context Windows": 0.4,
  },
  "data-pipeline": {
    Memory: 1.0,
    Orchestrators: 0.9,
    "Logging and Telemetry": 0.8,
    "API Integrations": 0.7,
    "MCP Tools": 0.6,
    Agents: 0.5,
    Skills: 0.45,
    "Prompt Templates": 0.45,
    "Context Windows": 0.5,
  },
  cli: {
    "MCP Tools": 0.9,
    "API Integrations": 0.8,
    Skills: 0.7,
    "Logging and Telemetry": 0.6,
    Agents: 0.5,
    Orchestrators: 0.5,
    Memory: 0.5,
    "Prompt Templates": 0.45,
    "Context Windows": 0.4,
  },
};

function categoryImportance(category: ToolCategory, projectType: string): number {
  const table = CATEGORY_IMPORTANCE[projectType];
  return table?.[category] ?? DEFAULT_IMPORTANCE;
}

/**
 * Weighted stack relevance in [0,1]. Framework and language matches count most,
 * since those are the strongest compatibility signals. Partial credit spreads
 * scores instead of clustering them.
 */
function stackMatchInput(tool: ToolRecord, stack: StackProfile): number {
  const text = `${tool.name} ${tool.description}`.toLowerCase();
  let score = 0;
  const fw = stack.framework?.toLowerCase();
  const lang = stack.language?.toLowerCase();
  const db = stack.database?.toLowerCase();
  const infra = stack.infrastructure?.toLowerCase();
  const ptype = stack.project_type?.toLowerCase();

  if (fw && fw !== "none" && text.includes(fw)) score += 0.4;
  if (lang && lang !== "other" && text.includes(lang)) score += 0.25;
  if (db && db !== "none" && text.includes(db)) score += 0.2;
  if (infra && infra !== "none" && text.includes(infra)) score += 0.1;
  if (ptype && ptype !== "none") {
    for (const token of ptype.split("-")) {
      if (token.length > 2 && text.includes(token)) {
        score += 0.1;
        break;
      }
    }
  }
  return Math.min(1, score);
}

/**
 * Category fit in [0,1]. Tools that fill a still-missing category get full
 * weight; already-covered categories are dampened. Within that, importance for
 * the project type differentiates tools. Increasing coverage (being missing)
 * never decreases the input, satisfying monotonicity.
 */
function categoryFitInput(tool: ToolRecord, stack: StackProfile): number {
  const importance = categoryImportance(tool.category, stack.project_type);
  const coverageFactor = stack.missing_categories.includes(tool.category) ? 1 : 0.4;
  return importance * coverageFactor;
}

/** Popularity in [0,1] (0 -> 0). Uses GitHub stars (log) or npm popularity. */
function popularityInput(tool: ToolRecord): number {
  const stars = typeof tool.stars === "number" && tool.stars > 0 ? tool.stars : 0;
  if (stars > 0) {
    // log10(stars+1) / log10(100000+1) caps around 100k stars.
    return Math.min(1, Math.log10(stars + 1) / Math.log10(100001));
  }
  if (typeof tool.popularity === "number" && tool.popularity > 0) {
    return Math.min(1, tool.popularity);
  }
  return 0;
}

/** Recency in [0,1]; more recent -> higher. Tight 1-year window for spread. */
function recencyInput(tool: ToolRecord): number {
  if (!tool.last_updated) {
    return 0;
  }
  const updated = Date.parse(tool.last_updated);
  if (Number.isNaN(updated)) {
    return 0;
  }
  const ageDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) {
    return 1;
  }
  // Smooth decay; ~0.5 at 6 months, ~0.25 at 1 year.
  return Math.max(0, 1 / (1 + ageDays / 180));
}

export function scoreTool(tool: ToolRecord, stack: StackProfile): number {
  const raw =
    W_STACK * stackMatchInput(tool, stack) +
    W_CATEGORY * categoryFitInput(tool, stack) +
    W_POPULARITY * popularityInput(tool) +
    W_RECENCY * recencyInput(tool);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function popularityValue(t: ToolRecord): number {
  if (typeof t.stars === "number" && t.stars > 0) {
    return t.stars;
  }
  if (typeof t.popularity === "number") {
    return t.popularity;
  }
  return 0;
}

function comparator(a: ToolRecord, b: ToolRecord): number {
  if (b.relevance_score !== a.relevance_score) {
    return b.relevance_score - a.relevance_score;
  }
  const popA = popularityValue(a);
  const popB = popularityValue(b);
  if (popB !== popA) {
    return popB - popA;
  }
  return a.name.localeCompare(b.name);
}

/**
 * Score, rank, cap to 10, and group by category. Returns an empty set for an
 * empty input without error. This is the MCP `get_recommendations` contract: a
 * focused shortlist of at most 10 tools for an agent.
 */
export function getRecommendations(
  tools: ToolRecord[],
  stack: StackProfile,
): Result<RecommendationGroup[]> {
  if (tools.length === 0) {
    return ok([]);
  }

  const scored = tools.map((t) => ({ ...t, relevance_score: scoreTool(t, stack) }));
  scored.sort(comparator);
  const top = scored.slice(0, MAX_RECOMMENDATIONS);

  const byCategory = new Map<ToolCategory, ToolRecord[]>();
  for (const tool of top) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }

  const groups: RecommendationGroup[] = [];
  for (const [category, list] of byCategory) {
    list.sort(comparator);
    groups.push({ category, tools: list });
  }
  // Order groups by their top tool's score descending.
  groups.sort((g1, g2) => (g2.tools[0]?.relevance_score ?? 0) - (g1.tools[0]?.relevance_score ?? 0));

  return ok(groups);
}

const DEFAULT_PER_CATEGORY = 6;

/**
 * Rank the full candidate pool and return up to `perCategory` tools for every
 * category. Used by the web dashboard, which shows all nine categories and
 * benefits from a richer set than the 10-item agent shortlist.
 */
export function getRecommendationsByCategory(
  tools: ToolRecord[],
  stack: StackProfile,
  perCategory: number = DEFAULT_PER_CATEGORY,
): Result<RecommendationGroup[]> {
  if (tools.length === 0) {
    return ok([]);
  }

  const scored = tools.map((t) => ({ ...t, relevance_score: scoreTool(t, stack) }));

  const byCategory = new Map<ToolCategory, ToolRecord[]>();
  for (const tool of scored) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }

  const groups: RecommendationGroup[] = [];
  for (const [category, list] of byCategory) {
    list.sort(comparator);
    groups.push({ category, tools: list.slice(0, perCategory) });
  }
  groups.sort((g1, g2) => (g2.tools[0]?.relevance_score ?? 0) - (g1.tools[0]?.relevance_score ?? 0));

  return ok(groups);
}
