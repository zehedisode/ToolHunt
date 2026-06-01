import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import type {
  RecommendationGroup,
  Result,
  StackProfile,
  ToolRecord,
} from "../types/index.js";
import { ok, err } from "../types/index.js";

export interface DbSchema {
  stack: StackProfile | null;
  tools: ToolRecord[];
  recommendations: RecommendationGroup[];
  lastScanAt: string | null;
}

const defaultData: DbSchema = {
  stack: null,
  tools: [],
  recommendations: [],
  lastScanAt: null,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/storage -> project root/.toolhunt/db.json
const DB_DIR = path.resolve(__dirname, "..", "..", ".toolhunt");
const DB_PATH = path.join(DB_DIR, "db.json");

let instance: Low<DbSchema> | null = null;

async function getDb(): Promise<Low<DbSchema>> {
  if (instance) {
    return instance;
  }
  await fs.mkdir(DB_DIR, { recursive: true });
  const adapter = new JSONFile<DbSchema>(DB_PATH);
  const db = new Low<DbSchema>(adapter, defaultData);
  await db.read();
  db.data ||= structuredClone(defaultData);
  instance = db;
  return db;
}

export async function getStack(): Promise<StackProfile | null> {
  const db = await getDb();
  return db.data.stack;
}

export async function getTools(): Promise<ToolRecord[]> {
  const db = await getDb();
  return db.data.tools;
}

export async function getRecommendations(): Promise<RecommendationGroup[]> {
  const db = await getDb();
  return db.data.recommendations;
}

export async function saveStack(stack: StackProfile): Promise<Result<void>> {
  try {
    const db = await getDb();
    db.data.stack = stack;
    await db.write();
    return ok(undefined);
  } catch (error) {
    return err(`Failed to persist stack: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Replace stored tool records. Retains previous data on failure. */
export async function saveTools(tools: ToolRecord[]): Promise<Result<void>> {
  const db = await getDb();
  const previous = db.data.tools;
  try {
    db.data.tools = tools;
    db.data.lastScanAt = new Date().toISOString();
    await db.write();
    return ok(undefined);
  } catch (error) {
    db.data.tools = previous; // restore in-memory copy
    return err(`Failed to persist tools: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Replace stored recommendations. Retains previous data on failure. */
export async function saveRecommendations(
  recommendations: RecommendationGroup[],
): Promise<Result<void>> {
  const db = await getDb();
  const previous = db.data.recommendations;
  try {
    db.data.recommendations = recommendations;
    await db.write();
    return ok(undefined);
  } catch (error) {
    db.data.recommendations = previous;
    return err(`Failed to persist recommendations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function recordInstalledTool(tool: ToolRecord): Promise<Result<void>> {
  try {
    const db = await getDb();
    const exists = db.data.tools.some((t) => t.name === tool.name && t.source === tool.source);
    if (!exists) {
      db.data.tools.push(tool);
    }
    await db.write();
    return ok(undefined);
  } catch (error) {
    return err(`Failed to record installed tool: ${error instanceof Error ? error.message : String(error)}`);
  }
}
