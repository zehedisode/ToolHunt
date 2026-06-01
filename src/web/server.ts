import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import { createApiRouter } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/web -> project root
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const UI_DIST = path.join(PROJECT_ROOT, "ui", "dist");

const CANDIDATE_PORTS = [3847, 3848, 3849];

async function uiExists(): Promise<boolean> {
  try {
    await fs.access(path.join(UI_DIST, "index.html"));
    return true;
  } catch {
    return false;
  }
}

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once("listening", () => resolve(server));
    server.once("error", (err) => reject(err));
  });
}

export async function startWebServer(): Promise<Server> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", createApiRouter());

  if (await uiExists()) {
    app.use(express.static(UI_DIST));
    // SPA fallback for client-side routing.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(UI_DIST, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send(
          "<h1>ToolHunt</h1><p>UI not built yet. Run <code>npm run build:ui</code>, then reload. The REST API is available under <code>/api</code>.</p>",
        );
    });
  }

  const tried: number[] = [];
  for (const port of CANDIDATE_PORTS) {
    try {
      const server = await listen(app, port);
      process.stdout.write(`ToolHunt web UI running at http://localhost:${port}\n`);
      return server;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE") {
        tried.push(port);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`All candidate ports are occupied: ${tried.join(", ")}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  startWebServer().catch((error) => {
    process.stderr.write(`Failed to start ToolHunt web server: ${String(error)}\n`);
    process.exit(1);
  });
}
