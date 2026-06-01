import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueries } from "../src/sources/websearch.js";
import type { StackProfile } from "../src/types/index.js";

const base: StackProfile = {
  language: "typescript",
  framework: "nextjs",
  database: "none",
  infrastructure: "none",
  existing_tools: [],
  project_type: "web-app",
  missing_categories: [],
};

test("buildQueries returns queries when stack fields are present", () => {
  const queries = buildQueries(base);
  assert.ok(queries.length > 0);
});

test("buildQueries returns empty when framework/language/project_type all empty", () => {
  const empty: StackProfile = {
    ...base,
    framework: "none",
    language: "other",
    project_type: "none",
  };
  assert.equal(buildQueries(empty).length, 0);
});

test("buildQueries adds a vector database query when no DB detected", () => {
  const queries = buildQueries(base);
  assert.ok(queries.some((q) => q.toLowerCase().includes("vector database")));
});
