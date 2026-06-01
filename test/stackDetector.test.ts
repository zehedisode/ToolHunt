import { test } from "node:test";
import assert from "node:assert/strict";
import { detectStack } from "../src/analyzer/stackDetector.js";
import type { RawProjectData } from "../src/types/index.js";
import { TOOL_CATEGORIES } from "../src/types/index.js";

function raw(partial: Partial<RawProjectData>): RawProjectData {
  return {
    projectPath: "/tmp/x",
    manifests: {},
    manifestText: {},
    readmeExcerpt: "",
    envKeys: [],
    directories: [],
    files: [],
    ...partial,
  };
}

test("detects Next.js web-app from package.json", () => {
  const stack = detectStack(
    raw({ manifests: { "package.json": { dependencies: { next: "14", react: "18" } } } }),
  );
  assert.equal(stack.language, "typescript");
  assert.equal(stack.framework, "nextjs");
  assert.equal(stack.project_type, "web-app");
});

test("detects FastAPI ai-agent from requirements.txt", () => {
  const stack = detectStack(
    raw({ manifestText: { "requirements.txt": "fastapi\nlangchain\nopenai" } }),
  );
  assert.equal(stack.language, "python");
  assert.equal(stack.framework, "fastapi");
  assert.equal(stack.project_type, "ai-agent");
});

test("always returns a fully populated profile", () => {
  const stack = detectStack(raw({}));
  for (const field of [
    "language",
    "framework",
    "database",
    "infrastructure",
    "project_type",
  ] as const) {
    assert.ok(stack[field] !== undefined && stack[field] !== null);
  }
  assert.ok(Array.isArray(stack.existing_tools));
  assert.ok(Array.isArray(stack.missing_categories));
});

test("empty project: language other, all categories missing", () => {
  const stack = detectStack(raw({}));
  assert.equal(stack.language, "other");
  assert.equal(stack.framework, "none");
  assert.equal(stack.missing_categories.length, TOOL_CATEGORIES.length);
});

test("existing tools remove their category from missing_categories", () => {
  const stack = detectStack(
    raw({ manifests: { "package.json": { dependencies: { langchain: "0.1", pinecone: "1" } } } }),
  );
  assert.ok(stack.existing_tools.includes("langchain"));
  assert.ok(!stack.missing_categories.includes("Orchestrators"));
});

test("detects postgres database", () => {
  const stack = detectStack(
    raw({ manifests: { "package.json": { dependencies: { next: "14", pg: "8" } } } }),
  );
  assert.equal(stack.database, "postgres");
});
