import { promises as fs } from "node:fs";
import path from "node:path";
import type { RawProjectData, Result } from "../types/index.js";
import { ok, err } from "../types/index.js";

const MANIFEST_FILES = [
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "composer.json",
] as const;

const README_MAX_LINES = 100;
const MAX_DEPTH = 3;
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "target",
  "__pycache__",
  ".venv",
  "venv",
]);

function isEnvFile(name: string): boolean {
  return name === ".env" || name.startsWith(".env.");
}

/**
 * Extract only the key names from .env file content. Values (everything after
 * the first `=`) are never read into memory beyond this function and are
 * discarded immediately. Comments and blank lines are skipped.
 */
export function extractEnvKeys(content: string): string[] {
  const keys: string[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      keys.push(line);
    } else {
      const key = line.slice(0, eqIndex).trim();
      if (key !== "") {
        keys.push(key);
      }
    }
  }
  return keys;
}

async function readReadmeExcerpt(projectPath: string): Promise<string> {
  // Try a few common casings.
  for (const candidate of ["README.md", "readme.md", "Readme.md"]) {
    try {
      const content = await fs.readFile(path.join(projectPath, candidate), "utf8");
      return content.split(/\r?\n/).slice(0, README_MAX_LINES).join("\n");
    } catch {
      // try next candidate
    }
  }
  return "";
}

async function walkDirectories(
  root: string,
): Promise<{ directories: string[]; files: string[]; envKeys: string[] }> {
  const directories: string[] = [];
  const files: string[] = [];
  const envKeys: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        directories.push(rel);
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        files.push(rel);
        if (isEnvFile(entry.name)) {
          try {
            const content = await fs.readFile(full, "utf8");
            for (const key of extractEnvKeys(content)) {
              if (!envKeys.includes(key)) {
                envKeys.push(key);
              }
            }
          } catch {
            // ignore unreadable env file
          }
        }
      }
    }
  }

  await walk(root, 1);
  return { directories, files, envKeys };
}

/**
 * Read project manifests, README excerpt, env key names, and directory
 * structure (max 3 levels). Unparseable manifests are excluded but do not
 * abort the scan. Never throws; returns a structured Result.
 */
export async function scanProject(
  projectPath: string,
): Promise<Result<RawProjectData>> {
  try {
    const stat = await fs.stat(projectPath);
    if (!stat.isDirectory()) {
      return err(`project_path is not a directory: ${projectPath}`);
    }
  } catch {
    return err(`project_path does not exist or is not readable: ${projectPath}`);
  }

  const manifests: Record<string, unknown> = {};
  const manifestText: Record<string, string> = {};

  for (const file of MANIFEST_FILES) {
    let content: string;
    try {
      content = await fs.readFile(path.join(projectPath, file), "utf8");
    } catch {
      continue; // file absent or unreadable
    }
    if (file.endsWith(".json")) {
      try {
        manifests[file] = JSON.parse(content);
      } catch {
        // Unparseable manifest: exclude from raw data, continue.
        continue;
      }
    } else {
      manifestText[file] = content;
    }
  }

  const readmeExcerpt = await readReadmeExcerpt(projectPath);
  const { directories, files, envKeys } = await walkDirectories(projectPath);

  return ok({
    projectPath,
    manifests,
    manifestText,
    readmeExcerpt,
    envKeys,
    directories,
    files,
  });
}
