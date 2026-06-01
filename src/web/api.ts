import { Router } from "express";
import type { Request, Response } from "express";
import { runScan } from "../core/scanService.js";
import { getStack, getTools, getRecommendations } from "../storage/db.js";
import { installTool } from "../installer/toolInstaller.js";
import type { InstallRequest } from "../types/index.js";

export function createApiRouter(): Router {
  const router = Router();

  // GET /api/status — health + MCP connection status.
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const stack = await getStack();
      res.json({
        health: "healthy",
        mcp: stack ? "connected" : "disconnected",
      });
    } catch {
      res.json({ health: "unhealthy", mcp: "disconnected" });
    }
  });

  // POST /api/scan — trigger analyze + search + recommend.
  router.post("/scan", async (req: Request, res: Response) => {
    const projectPath = typeof req.body?.project_path === "string"
      ? req.body.project_path
      : process.cwd();
    const result = await runScan(projectPath);
    if (!result.ok) {
      res.status(502).json({ triggered: true, error: result.error });
      return;
    }
    res.json({
      triggered: true,
      stack: result.data.stack,
      recommendationCount: result.data.recommendations.reduce((n, g) => n + g.tools.length, 0),
      webSearchUnavailable: result.data.webSearchUnavailable,
    });
  });

  // GET /api/recommendations — cached recommendations.
  router.get("/recommendations", async (_req: Request, res: Response) => {
    try {
      const [recommendations, stack] = await Promise.all([getRecommendations(), getStack()]);
      res.json({ stack, recommendations });
    } catch {
      res.json({ stack: null, recommendations: [] });
    }
  });

  // GET /api/tools — all discovered tools.
  router.get("/tools", async (_req: Request, res: Response) => {
    try {
      const tools = await getTools();
      res.json({ tools });
    } catch {
      res.json({ tools: [] });
    }
  });

  // POST /api/install — install a selected tool.
  router.post("/install", async (req: Request, res: Response) => {
    const body = req.body as Partial<InstallRequest> & { allow_overwrite?: boolean };
    if (!body?.tool_name || !body?.install_command || !body?.config_type) {
      res.status(400).json({ outcome: "failed", error: "Missing or invalid tool selection" });
      return;
    }
    const request: InstallRequest = {
      tool_name: body.tool_name,
      install_command: body.install_command,
      project_path: body.project_path || process.cwd(),
      config_type: body.config_type,
      agent: body.agent,
    };
    const result = await installTool(request, { allowOverwrite: body.allow_overwrite ?? false });
    if (!result.ok) {
      res.status(400).json({ outcome: "failed", error: result.error });
      return;
    }
    // For manual/env there is no config to update, so success hinges on install.
    const needsConfig = request.config_type === "mcp_json" || request.config_type === "package_json";
    const succeeded = result.data.installed && (!needsConfig || result.data.config_updated);
    res.json({ outcome: succeeded ? "succeeded" : "failed", details: result.data });
  });

  return router;
}
