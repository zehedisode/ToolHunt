import { test } from "node:test";
import assert from "node:assert/strict";
import { getRecommendations, scoreTool } from "../src/mcp/tools/recommend.js";
import type { StackProfile, ToolRecord } from "../src/types/index.js";

const stack: StackProfile = {
  language: "typescript",
  framework: "nextjs",
  database: "postgres",
  infrastructure: "vercel",
  existing_tools: [],
  project_type: "web-app",
  missing_categories: [
    "MCP Tools",
    "Skills",
    "Agents",
    "Memory",
    "Orchestrators",
    "Context Windows",
    "Prompt Templates",
    "Logging and Telemetry",
    "API Integrations",
  ],
};

function tool(over: Partial<ToolRecord>): ToolRecord {
  return {
    name: "x",
    description: "",
    source: "npm",
    url: "https://example.com",
    install_command: "npm i x",
    category: "API Integrations",
    relevance_score: 0,
    ...over,
  };
}

test("scores are clamped to [0,100]", () => {
  const s = scoreTool(
    tool({ stars: 1_000_000, last_updated: new Date().toISOString(), description: "nextjs typescript postgres vercel web" }),
    stack,
  );
  assert.ok(s >= 0 && s <= 100);
});

test("popularity is monotonic: more stars never lowers the score", () => {
  const low = scoreTool(tool({ stars: 10 }), stack);
  const high = scoreTool(tool({ stars: 10000 }), stack);
  assert.ok(high >= low);
});

test("recency is monotonic: newer never lowers the score", () => {
  const old = scoreTool(tool({ last_updated: "2015-01-01T00:00:00Z" }), stack);
  const recent = scoreTool(tool({ last_updated: new Date().toISOString() }), stack);
  assert.ok(recent >= old);
});

test("stack match raises the score", () => {
  const noMatch = scoreTool(tool({ description: "unrelated thing" }), stack);
  const match = scoreTool(tool({ description: "built for nextjs and postgres" }), stack);
  assert.ok(match >= noMatch);
});

test("empty input returns empty recommendations without error", () => {
  const res = getRecommendations([], stack);
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.data.length, 0);
});

test("returns at most 10 tools in total", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    tool({ name: `t${i}`, stars: i * 100, category: "MCP Tools" }),
  );
  const res = getRecommendations(many, stack);
  assert.ok(res.ok);
  if (res.ok) {
    const total = res.data.reduce((n, g) => n + g.tools.length, 0);
    assert.ok(total <= 10);
  }
});

test("tools are grouped by category and sorted by score desc", () => {
  const tools = [
    tool({ name: "a", category: "Memory", stars: 5 }),
    tool({ name: "b", category: "Memory", stars: 5000 }),
  ];
  const res = getRecommendations(tools, stack);
  assert.ok(res.ok);
  if (res.ok) {
    const mem = res.data.find((g) => g.category === "Memory");
    assert.ok(mem);
    assert.ok(mem!.tools[0].relevance_score >= mem!.tools[1].relevance_score);
  }
});
