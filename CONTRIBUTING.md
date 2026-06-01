# Contributing to ToolHunt

Thanks for your interest in improving ToolHunt. This guide covers how to get set up, the project conventions, and how to add the most common kind of contribution: a new tool source.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Getting started

```bash
git clone https://github.com/zehedisode/ToolHunt.git
cd ToolHunt
npm install
npm run build:all
npm test
```

- `npm run build` — type-checks and builds the MCP server (strict TypeScript).
- `npm run build:ui` — builds the React dashboard.
- `npm test` — runs the unit test suite (`node --test` via `tsx`).
- `npm run dev:mcp` / `npm run dev:web` — watch-mode for the server and web API.

## Project layout

```
src/
  mcp/        MCP server + the four tools (analyze, search, recommend, install)
  sources/    Tool sources (npm, GitHub, Smithery, Tavily)
  analyzer/   Project scanner + stack detector
  installer/  Tool installer + config updater
  web/        Express server + REST API
  storage/    lowdb persistence
  core/       Scan orchestration
ui/           React + Vite + Tailwind dashboard
test/         Unit tests
```

## Conventions

- **TypeScript strict mode** is on; the build must report zero type errors.
- **No unhandled rejections.** Every async function that does I/O wraps it in
  `try/catch` and returns a `Result<T>` (`{ ok: true, data }` or `{ ok: false, error }`)
  rather than throwing.
- **External calls must time out** (5s for registries, 10s for web search) and
  degrade to an empty result set on failure — never abort the whole search.
- **Privacy:** never read `.env` values, only key names.
- **Safety:** the installer never deletes files and never overwrites an existing
  MCP config entry without confirmation.
- Match the existing style; avoid adding dependencies without discussion.

## Adding a new tool source

Sources are small, self-contained connectors in `src/sources/`. To add one:

1. Create `src/sources/yoursource.ts` exporting an async function that returns a
   `SourceResult` (`{ source, tools, error? }`). Use `fetchJson` / `fetchText`
   from `httpClient.ts` so you inherit the timeout and error handling.
2. Assign each tool a `category` from the nine `TOOL_CATEGORIES`. Prefer a
   keyword gate (see `npm.ts` `classifyNpmPackage`) over guessing, so unrelated
   packages do not pollute a category.
3. Register the source in `src/mcp/tools/search.ts`. If it needs an API key,
   gate it on an env var (see how Smithery and Tavily are handled) so ToolHunt
   keeps working without it.
4. Add a unit test for your classification/parsing logic in `test/`.
5. Run `npm run build` and `npm test`.

## Pull requests

- Branch off `main`; do not push directly to `main`.
- Keep PRs focused. Include what you changed and how you tested it.
- Ensure `npm run build`, `npm run build:ui`, and `npm test` all pass. CI runs
  these on Node 20 and 22.
- Be excellent to each other. By contributing you agree to license your work
  under the project's MIT license.
