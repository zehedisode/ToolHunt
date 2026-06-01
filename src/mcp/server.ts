#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { analyzeProject } from "./tools/analyze.js";
import { searchTools } from "./tools/search.js";
import { getRecommendations } from "./tools/recommend.js";
import { installTool } from "../installer/toolInstaller.js";
import { TOOL_CATEGORIES } from "../types/index.js";
import type { StackProfile, ToolRecord } from "../types/index.js";

const stackShape = {
  language: z.enum(["typescript", "python", "rust", "go", "other"]),
  framework: z.string(),
  database: z.string(),
  infrastructure: z.string(),
  existing_tools: z.array(z.string()),
  project_type: z.string(),
  missing_categories: z.array(z.enum(TOOL_CATEGORIES)),
};

const toolRecordShape = z.object({
  name: z.string(),
  description: z.string(),
  source: z.string(),
  url: z.string(),
  install_command: z.string(),
  category: z.enum(TOOL_CATEGORIES),
  relevance_score: z.number(),
  stars: z.number().optional(),
  popularity: z.number().optional(),
  last_updated: z.string().optional(),
});

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorContent(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "toolhunt",
    version: "0.1.0",
  });

  server.registerTool(
    "analyze_project",
    {
      title: "Analyze Project",
      description:
        "Analyze the open project at project_path and return a structured stack profile (language, framework, database, infrastructure, existing_tools, project_type, missing_categories).",
      inputSchema: { project_path: z.string().describe("Absolute path to the project root") },
    },
    async ({ project_path }) => {
      const result = await analyzeProject(project_path);
      if (!result.ok) {
        return errorContent(result.error);
      }
      return jsonContent(result.data);
    },
  );

  server.registerTool(
    "search_tools",
    {
      title: "Search Tools",
      description:
        "Search mcp.so, smithery.ai, GitHub awesome-mcp lists, and (if configured) Tavily web search in parallel for tools matching the given stack profile.",
      inputSchema: { stack: z.object(stackShape).describe("Stack profile from analyze_project") },
    },
    async ({ stack }) => {
      const result = await searchTools(stack as StackProfile);
      if (!result.ok) {
        return errorContent(result.error);
      }
      return jsonContent(result.data);
    },
  );

  server.registerTool(
    "get_recommendations",
    {
      title: "Get Recommendations",
      description:
        "Score and rank discovered tools against the stack profile, returning up to 10 tools grouped by category.",
      inputSchema: {
        tools: z.array(toolRecordShape).describe("Tool records from search_tools"),
        stack: z.object(stackShape).describe("Stack profile from analyze_project"),
      },
    },
    async ({ tools, stack }) => {
      const result = getRecommendations(tools as ToolRecord[], stack as StackProfile);
      if (!result.ok) {
        return errorContent(result.error);
      }
      return jsonContent(result.data);
    },
  );

  server.registerTool(
    "install_tool",
    {
      title: "Install Tool",
      description:
        "Install an approved tool by running install_command in project_path and updating the appropriate config file. Will not overwrite existing MCP entries or delete files without confirmation.",
      inputSchema: {
        tool_name: z.string(),
        install_command: z.string(),
        project_path: z.string(),
        config_type: z.enum(["mcp_json", "package_json", "env", "manual"]),
        agent: z.enum(["kiro", "claude", "cursor"]).optional(),
        allow_overwrite: z.boolean().optional().describe("Set true to confirm overwriting an existing MCP entry"),
      },
    },
    async ({ tool_name, install_command, project_path, config_type, agent, allow_overwrite }) => {
      const result = await installTool(
        { tool_name, install_command, project_path, config_type, agent },
        { allowOverwrite: allow_overwrite ?? false },
      );
      if (!result.ok) {
        return errorContent(result.error);
      }
      return jsonContent(result.data);
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so we never corrupt the stdio JSON-RPC stream.
  process.stderr.write("ToolHunt MCP server running on stdio\n");
}

main().catch((error) => {
  process.stderr.write(`ToolHunt MCP server failed to start: ${String(error)}\n`);
  process.exit(1);
});
