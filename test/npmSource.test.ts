import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyNpmPackage } from "../src/sources/npm.js";

// classifyNpmPackage applies the category keyword gate + noise filter that
// keeps framework-named but category-irrelevant packages out of categories.

test("accepts a real MCP package into MCP Tools", () => {
  const r = classifyNpmPackage("mcp-proxy", "A proxy for Model Context Protocol servers", "MCP Tools");
  assert.notEqual(r, null);
});

test("rejects framework package miscategorized as MCP Tools", () => {
  const r = classifyNpmPackage("@storybook/nextjs", "Storybook for Next.js", "MCP Tools");
  assert.equal(r, null);
});

test("rejects auth package miscategorized as Prompt Templates", () => {
  const r = classifyNpmPackage("@auth0/nextjs-auth0", "Auth0 SDK for Next.js", "Prompt Templates");
  assert.equal(r, null);
});

test("accepts a vector DB into Memory", () => {
  const r = classifyNpmPackage("@pinecone-database/pinecone", "Pinecone vector database client", "Memory");
  assert.notEqual(r, null);
});

test("filters out scaffolding/boilerplate packages", () => {
  const r = classifyNpmPackage("create-next-app", "Create Next.js apps", "MCP Tools");
  assert.equal(r, null);
});

test("accepts langchain into Orchestrators", () => {
  const r = classifyNpmPackage("@langchain/langgraph", "LangGraph orchestration for agents", "Orchestrators");
  assert.notEqual(r, null);
});
