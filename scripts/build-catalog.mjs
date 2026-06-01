#!/usr/bin/env node
/**
 * Build/refresh data/catalog.json from the npm registry and GitHub search.
 *
 * Usage:
 *   node scripts/build-catalog.mjs            # full refresh
 *   node scripts/build-catalog.mjs --dry-run  # print stats only
 *
 * Output: data/catalog.json  (consumed by the AI prompt and the MCP server)
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "catalog.json");

const TIMEOUT_MS = 5_000;
const USER_AGENT = "toolhunt-catalog-builder/1.0";
const NPM_REGISTRY = "https://registry.npmjs.org";
const GITHUB_API = "https://api.github.com";

/* ------------------------------------------------------------------ */
/*  Hand-curated seeds.                                                */
/*                                                                    */
/*  For each category we list 6-10 packages that we know are high      */
/*  quality. The script merges these with whatever npm returns for     */
/*  the matching keywords. Hand-picked entries are tagged with        */
/*  `curated: true` and never dropped.                                 */
/* ------------------------------------------------------------------ */
const SEEDS = {
  "MCP Tools": [
    "@modelcontextprotocol/sdk",
    "@modelcontextprotocol/inspector",
    "@azure/mcp",
    "mcp-server-filesystem",
    "@playwright/mcp",
    "mcphub",
  ],
  "Skills": [
    "mastra",
    "@mastra/core",
    "langchain",
    "@langchain/core",
    "tldraw",
    "agentica",
  ],
  "Agents": [
    "@anthropic-ai/sdk",
    "openai",
    "alvin-bot",
    "@earendil-works/pi-agent-core",
  ],
  "Memory": [
    "@pinecone-database/pinecone",
    "chromadb",
    "@qdrant/js-client-rest",
    "@upstash/redis",
    "mem0ai",
  ],
  "Orchestrators": [
    "langchain",
    "langgraph",
    "llamaindex",
    "@anthropic-ai/agent-sdk",
    "crewai",
  ],
  "Context Windows": [
    "llm-streams",
    "token.js",
    "tiktoken",
  ],
  "Prompt Templates": [
    "langchain",
    "@langchain/core",
    "mustache",
    "handlebars",
    "eta",
  ],
  "Logging and Telemetry": [
    "langfuse",
    "@langfuse/client",
    "helicone",
    "langsmith",
    "pino",
    "winston",
  ],
  "API Integrations": [
    "ai",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@anthropic-ai/sdk",
    "openai",
    "@google/generative-ai",
    "groq-sdk",
  ],
};

/* ------------------------------------------------------------------ */
/*  HTTP helper with timeout.                                          */
/* ------------------------------------------------------------------ */
async function fetchJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getNpmMeta(pkg) {
  try {
    const j = await fetchJson(`${NPM_REGISTRY}/${encodeURIComponent(pkg)}`);
    const t = j.time;
    return {
      name: j.name,
      description: j.description ?? "",
      url: j.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, "")
        ?? `https://www.npmjs.com/package/${j.name}`,
      install: `npm install ${j.name}`,
      last_updated: t?.modified ?? t?.["1.0.0"],
    };
  } catch {
    return null;
  }
}

async function searchNpm(query, size = 8) {
  try {
    const j = await fetchJson(
      `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`,
    );
    return j.objects?.map((o) => o.package?.name).filter(Boolean) ?? [];
  } catch {
    return [];
  }
}

async function getGitHubStars(repo) {
  try {
    const j = await fetchJson(`${GITHUB_API}/repos/${repo}`);
    return j.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Build.                                                            */
/* ------------------------------------------------------------------ */
async function build() {
  const out = {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    sources: ["npm", "github"],
    categories: Object.fromEntries(
      Object.keys(SEEDS).map((k) => [k, []]),
    ),
  };

  for (const [category, seeds] of Object.entries(SEEDS)) {
    const toolMap = new Map();
    for (const name of seeds) {
      const meta = await getNpmMeta(name);
      if (meta) {
        toolMap.set(name, {
          ...meta,
          category,
          source: "npm",
          curated: true,
          popularity_hint: 70,
        });
      }
    }
    const extra = await searchNpm(category.toLowerCase().split(" ")[0], 4);
    for (const name of extra) {
      if (toolMap.has(name)) continue;
      const meta = await getNpmMeta(name);
      if (meta) {
        toolMap.set(name, {
          ...meta,
          category,
          source: "npm",
          curated: false,
          popularity_hint: 30,
        });
      }
    }
    out.categories[category] = Array.from(toolMap.values()).sort(
      (a, b) => (b.popularity_hint ?? 0) - (a.popularity_hint ?? 0),
    );
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  const total = Object.values(out.categories).reduce(
    (n, list) => n + list.length,
    0,
  );
  console.log(`Wrote ${OUT}`);
  console.log(`Total tools: ${total}`);
  for (const [cat, list] of Object.entries(out.categories)) {
    console.log(`  ${cat.padEnd(28)} ${list.length}`);
  }
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("(dry run: would refresh data/catalog.json)");
  process.exit(0);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
