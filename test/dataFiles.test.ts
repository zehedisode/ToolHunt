/**
 * Validate that data/catalog.json and data/stack-profiles.json match the
 * schemas the PROMPT.md and the MCP server expect.
 */
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_CATEGORIES } from "../src/types/index.js";

const CATALOG = JSON.parse(
  readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"),
);
const PROFILES = JSON.parse(
  readFileSync(new URL("../data/stack-profiles.json", import.meta.url), "utf8"),
);

const errors = [];

/* ---- catalog ---- */
if (!CATALOG.version) errors.push("catalog: missing version");
if (!CATALOG.generated_at) errors.push("catalog: missing generated_at");
if (!CATALOG.categories || typeof CATALOG.categories !== "object") {
  errors.push("catalog: missing categories object");
} else {
  for (const cat of TOOL_CATEGORIES) {
    const list = CATALOG.categories[cat];
    if (!Array.isArray(list)) {
      errors.push(`catalog: category ${cat} missing or not an array`);
      continue;
    }
    for (const t of list) {
      for (const k of [
        "name",
        "description",
        "url",
        "install",
        "popularity_hint",
        "recency_hint",
      ]) {
        if (!(k in t)) {
          errors.push(`catalog: tool ${t.name ?? "<unnamed>"} missing ${k}`);
        }
      }
      if (typeof t.popularity_hint !== "number" || t.popularity_hint < 0 || t.popularity_hint > 100) {
        errors.push(`catalog: tool ${t.name} popularity_hint out of range`);
      }
      if (t.recency_hint && Number.isNaN(Date.parse(t.recency_hint))) {
        errors.push(`catalog: tool ${t.name} recency_hint not a valid date`);
      }
    }
  }
}

/* ---- profiles ---- */
for (const section of ["languages", "frameworks", "databases", "infrastructure", "project_types"]) {
  if (!PROFILES[section]) errors.push(`profiles: missing section ${section}`);
}
const imp = PROFILES.category_importance;
if (!imp) {
  errors.push("profiles: missing category_importance");
} else {
  for (const projectType of Object.keys(imp)) {
    if (projectType.startsWith("_")) continue;
    for (const cat of TOOL_CATEGORIES) {
      const v = imp[projectType]?.[cat];
      if (v !== undefined && (v < 0 || v > 1)) {
        errors.push(
          `profiles: category_importance.${projectType}.${cat} = ${v} (out of [0,1])`,
        );
      }
    }
  }
}

if (errors.length === 0) {
  console.log("OK  data/catalog.json");
  console.log("OK  data/stack-profiles.json");
}
for (const e of errors) console.log("ERR " + e);

test("data/catalog.json and data/stack-profiles.json are valid", () => {
  assert.deepEqual(errors, [], `Validation errors:\n${errors.join("\n")}`);
});
