import type {
  Language,
  RawProjectData,
  StackProfile,
  ToolCategory,
} from "../types/index.js";
import { TOOL_CATEGORIES } from "../types/index.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function allDeps(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function hasAny(deps: Record<string, string>, names: string[]): boolean {
  return names.some((n) => n in deps);
}

function detectLanguage(raw: RawProjectData): Language {
  const m = raw.manifests;
  const t = raw.manifestText;
  if ("package.json" in m) return "typescript";
  if ("Cargo.toml" in t) return "rust";
  if ("go.mod" in t) return "go";
  if ("requirements.txt" in t || "composer.json" in m) {
    return "composer.json" in m ? "other" : "python";
  }
  // Heuristic from file extensions.
  const exts = raw.files.map((f) => f.split(".").pop()?.toLowerCase());
  if (exts.includes("ts") || exts.includes("tsx") || exts.includes("js")) {
    return "typescript";
  }
  if (exts.includes("py")) return "python";
  if (exts.includes("rs")) return "rust";
  if (exts.includes("go")) return "go";
  return "other";
}

function detectFramework(raw: RawProjectData, language: Language): string {
  if (language === "typescript") {
    const pkg = (raw.manifests["package.json"] as PackageJson) ?? {};
    const deps = allDeps(pkg);
    if (hasAny(deps, ["next"])) return "nextjs";
    if (hasAny(deps, ["@remix-run/react", "@remix-run/node"])) return "remix";
    if (hasAny(deps, ["nuxt"])) return "nuxt";
    if (hasAny(deps, ["@nestjs/core"])) return "nestjs";
    if (hasAny(deps, ["express"])) return "express";
    if (hasAny(deps, ["fastify"])) return "fastify";
    if (hasAny(deps, ["@sveltejs/kit", "svelte"])) return "svelte";
    if (hasAny(deps, ["vue"])) return "vue";
    if (hasAny(deps, ["react"])) return "react";
    return "none";
  }
  if (language === "python") {
    const reqs = (raw.manifestText["requirements.txt"] ?? "").toLowerCase();
    if (reqs.includes("fastapi")) return "fastapi";
    if (reqs.includes("django")) return "django";
    if (reqs.includes("flask")) return "flask";
    return "none";
  }
  if (language === "rust") {
    const cargo = (raw.manifestText["Cargo.toml"] ?? "").toLowerCase();
    if (cargo.includes("axum")) return "axum";
    if (cargo.includes("actix")) return "actix";
    if (cargo.includes("rocket")) return "rocket";
    return "none";
  }
  if (language === "go") {
    const gomod = (raw.manifestText["go.mod"] ?? "").toLowerCase();
    if (gomod.includes("gin-gonic")) return "gin";
    if (gomod.includes("labstack/echo")) return "echo";
    if (gomod.includes("gofiber")) return "fiber";
    return "none";
  }
  return "none";
}

function detectDatabase(raw: RawProjectData, language: Language): string {
  const haystack = buildHaystack(raw, language);
  if (/\b(pg|postgres|postgresql|@neondatabase|prisma)\b/.test(haystack)) {
    if (/\b(postgres|postgresql|pg|@neondatabase)\b/.test(haystack)) return "postgres";
  }
  if (/\b(mongodb|mongoose)\b/.test(haystack)) return "mongodb";
  if (/\b(mysql|mysql2)\b/.test(haystack)) return "mysql";
  if (/\b(sqlite|better-sqlite3|sqlite3)\b/.test(haystack)) return "sqlite";
  if (/\b(redis|ioredis)\b/.test(haystack)) return "redis";
  return "none";
}

function detectInfrastructure(raw: RawProjectData): string {
  const files = raw.files.map((f) => f.toLowerCase());
  const dirs = raw.directories.map((d) => d.toLowerCase());
  if (files.some((f) => f.endsWith("dockerfile") || f.includes("docker-compose"))) {
    return "docker";
  }
  if (files.some((f) => f.includes("vercel.json")) || dirs.some((d) => d.includes(".vercel"))) {
    return "vercel";
  }
  if (files.some((f) => f.includes("netlify.toml"))) return "netlify";
  if (
    dirs.some((d) => d.includes(".github/workflows")) ||
    files.some((f) => f.includes(".github/workflows"))
  ) {
    return "github-actions";
  }
  if (files.some((f) => f.includes("serverless.yml") || f.includes("template.yaml"))) {
    return "aws";
  }
  return "none";
}

function detectProjectType(raw: RawProjectData, framework: string): string {
  const haystack = buildHaystack(raw, detectLanguage(raw));
  if (/\b(langchain|langgraph|crewai|autogen|@modelcontextprotocol|openai|anthropic)\b/.test(haystack)) {
    return "ai-agent";
  }
  if (["nextjs", "remix", "nuxt", "svelte", "vue", "react"].includes(framework)) {
    return "web-app";
  }
  if (["express", "fastify", "nestjs", "fastapi", "django", "flask", "axum", "gin", "echo"].includes(framework)) {
    return "api";
  }
  const pkg = raw.manifests["package.json"] as PackageJson | undefined;
  if (pkg?.scripts && Object.keys(pkg.scripts).length > 0 && framework === "none") {
    if ("bin" in (raw.manifests["package.json"] as Record<string, unknown>)) return "cli";
  }
  if (raw.directories.some((d) => /(^|\/)(pipelines?|etl|dags)/.test(d.toLowerCase()))) {
    return "data-pipeline";
  }
  return "library";
}

function buildHaystack(raw: RawProjectData, language: Language): string {
  const parts: string[] = [];
  if (language === "typescript") {
    const pkg = (raw.manifests["package.json"] as PackageJson) ?? {};
    parts.push(...Object.keys(allDeps(pkg)));
  }
  parts.push(...Object.values(raw.manifestText));
  parts.push(raw.readmeExcerpt);
  return parts.join("\n").toLowerCase();
}

/**
 * Identify already-present AI tools and which categories they cover, so we can
 * compute missing_categories.
 */
function detectExistingTools(raw: RawProjectData): {
  tools: string[];
  coveredCategories: Set<ToolCategory>;
} {
  const tools: string[] = [];
  const covered = new Set<ToolCategory>();
  const haystack = buildHaystack(raw, detectLanguage(raw));

  const signatures: Array<{ pattern: RegExp; name: string; category: ToolCategory }> = [
    { pattern: /@modelcontextprotocol\/sdk/, name: "@modelcontextprotocol/sdk", category: "MCP Tools" },
    { pattern: /\blangchain\b/, name: "langchain", category: "Orchestrators" },
    { pattern: /\blanggraph\b/, name: "langgraph", category: "Orchestrators" },
    { pattern: /\bcrewai\b/, name: "crewai", category: "Orchestrators" },
    { pattern: /\bautogen\b/, name: "autogen", category: "Orchestrators" },
    { pattern: /\bpinecone\b/, name: "pinecone", category: "Memory" },
    { pattern: /\bweaviate\b/, name: "weaviate", category: "Memory" },
    { pattern: /\bchromadb|chroma\b/, name: "chroma", category: "Memory" },
    { pattern: /\bqdrant\b/, name: "qdrant", category: "Memory" },
    { pattern: /\blangfuse\b/, name: "langfuse", category: "Logging and Telemetry" },
    { pattern: /\blangsmith\b/, name: "langsmith", category: "Logging and Telemetry" },
    { pattern: /\bhelicone\b/, name: "helicone", category: "Logging and Telemetry" },
    { pattern: /\bopenai\b/, name: "openai", category: "API Integrations" },
    { pattern: /\banthropic\b/, name: "anthropic", category: "API Integrations" },
  ];

  for (const sig of signatures) {
    if (sig.pattern.test(haystack)) {
      tools.push(sig.name);
      covered.add(sig.category);
    }
  }
  return { tools, coveredCategories: covered };
}

/**
 * Derive a structured Stack_Profile from raw project data. Pure and total:
 * always returns a fully-populated profile.
 */
export function detectStack(raw: RawProjectData): StackProfile {
  const language = detectLanguage(raw);

  if (language === "other" && Object.keys(raw.manifests).length === 0 && raw.files.length === 0) {
    return {
      language: "other",
      framework: "none",
      database: "none",
      infrastructure: "none",
      existing_tools: [],
      project_type: "library",
      missing_categories: [...TOOL_CATEGORIES],
    };
  }

  const framework = language === "other" ? "none" : detectFramework(raw, language);
  const database = language === "other" ? "none" : detectDatabase(raw, language);
  const infrastructure = detectInfrastructure(raw);
  const { tools, coveredCategories } = detectExistingTools(raw);
  const projectType = detectProjectType(raw, framework);

  const missing = TOOL_CATEGORIES.filter((c) => !coveredCategories.has(c));

  return {
    language,
    framework,
    database,
    infrastructure,
    existing_tools: tools,
    project_type: projectType,
    missing_categories: missing,
  };
}
