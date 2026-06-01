import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEnvKeys } from "../src/analyzer/projectScanner.js";

test("extracts key names without values (privacy)", () => {
  const content = "API_KEY=super-secret-value\nDATABASE_URL=postgres://u:p@host/db";
  const keys = extractEnvKeys(content);
  assert.deepEqual(keys, ["API_KEY", "DATABASE_URL"]);
});

test("never leaks any value text", () => {
  const content = "TOKEN=abc123\nPASSWORD=hunter2";
  const keys = extractEnvKeys(content);
  const joined = keys.join("|");
  assert.ok(!joined.includes("abc123"));
  assert.ok(!joined.includes("hunter2"));
});

test("skips comments and blank lines", () => {
  const content = "# a comment\n\n  \nFOO=bar";
  assert.deepEqual(extractEnvKeys(content), ["FOO"]);
});

test("retains a key with no '=' as a bare key name", () => {
  const content = "STANDALONE_FLAG\nFOO=bar";
  assert.deepEqual(extractEnvKeys(content), ["STANDALONE_FLAG", "FOO"]);
});

test("trims surrounding whitespace from keys", () => {
  const content = "  SPACED_KEY  = value";
  assert.deepEqual(extractEnvKeys(content), ["SPACED_KEY"]);
});
