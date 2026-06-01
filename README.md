# 🎣 ToolHunt

> The AI tool recommender that runs as **a single prompt**. No install, no
> MCP server, no config — paste the prompt into any AI assistant and tell it
> which project to analyze.

ToolHunt reads your project, scores a curated catalog of AI tools against
it, and produces a markdown report with the top picks, the install command
for each, and a one-line "why" for every recommendation. A build-time MCP
server is also available for power users who want live catalog refresh and
in-IDE install.

---

## 🚀 Use it as a prompt (30 seconds)

1. Open this repo's **[`PROMPT.md`](PROMPT.md)** — that's the whole product.
2. Copy everything in the file (it's a single fenced code block).
3. Paste it into **Claude Code, Cursor, Kiro, ChatGPT, Gemini, or any LLM**.
4. After the prompt, describe your project:
   ```
   Analyze the project at C:\Users\me\code\my-app.
   ```
5. Read the report. Install what you want with the `npm install ...` lines
   from the report.

That's it. Nothing to install, no API keys required, works on any project in
any language. The prompt is fully self-contained — it inlines a curated
catalog and the scoring rubric so it works even with no network access.

### Hybrid mode (recommended)

The prompt runs in **hybrid mode** by default: the AI scores the curated
catalog, then uses its own web tools to discover 3-5 additional tools per
missing category. The result is high-quality *and* up-to-date — curated for
signal, live for freshness. Every recommendation in the report is tagged
with its source (`curated`, `live-search`, or `model-knowledge`) so you
know what to trust.

### What the report looks like

```markdown
# 🎣 ToolHunt Report — my-app

**Stack detected:** typescript + react + sqlite on none
**Project type:** web-app
**Missing categories:** 9 of 9

## TL;DR — Top 3 picks
1. **ai** (API Integrations, score 89) — Vercel AI SDK; React hooks for OpenAI/Anthropic/...
2. **langfuse** (Logging and Telemetry, score 76) — LLM observability with traces and evals
3. **@mastra/core** (Skills, score 71) — TypeScript agent framework with RAG and memory
...
```

See the full template in [`data/output-template.md`](data/output-template.md).

---

## 📦 What's in the box

| File | What it is | Who reads it |
|------|------------|--------------|
| **[`PROMPT.md`](PROMPT.md)** | The single prompt that runs ToolHunt. | The user pastes it. |
| **[`data/catalog.json`](data/catalog.json)** | Curated tool catalog (50+ entries, 9 categories). | The AI reads it during scoring. |
| **[`data/stack-profiles.json`](data/stack-profiles.json)** | Stack detection patterns + category importance table. | The AI reads it during detection. |
| **[`data/scoring-rubric.md`](data/scoring-rubric.md)** | The 0-100 scoring formula in human-readable form. | The AI reads it during scoring. |
| **[`data/output-template.md`](data/output-template.md)** | The report format. | The AI reads it before writing. |
| **`src/`** | TypeScript MCP server + web UI (advanced users). | Power users. |
| **`scripts/build-catalog.mjs`** | Refreshes `data/catalog.json` from npm + GitHub. | Maintainers. |
| **[`AGENT_SETUP.md`](AGENT_SETUP.md)** | Setup prompt for installing the MCP server in a project. | Power users with an agent. |

---

## 🧠 How it works

1. **Detect** — Read manifests, README, env keys (names only), and the
   directory tree. Apply the patterns in `data/stack-profiles.json` to
   identify language, framework, database, infrastructure, project type, and
   which of the 9 AI-tool categories the project already covers.
2. **Score** — For every tool in `data/catalog.json`, compute a 0-100 score
   using the weighted sum in `data/scoring-rubric.md`:

   ```
   score = round(25 * stackMatch + 45 * categoryFit + 18 * popularity + 12 * recency)
   ```

   `categoryFit` dominates: a tool that fills a *missing* category for the
   project's type always outranks a popular tool in a category the project
   doesn't need.
3. **Report** — Output the top 1-2 tools per relevant category, with
   install commands, a one-line "why" for each, and a short "what I did NOT
   recommend" section. The format is in `data/output-template.md`.

The same algorithm is implemented in TypeScript at
[`src/mcp/tools/recommend.ts`](src/mcp/tools/recommend.ts) so the prompt and
the MCP server always agree.

## The nine tool categories

1. **MCP Tools** — Model Context Protocol servers
2. **Skills** — Agent/tool frameworks
3. **Agents** — Direct LLM SDKs and agent runtimes
4. **Memory** — Vector databases and long-term memory layers
5. **Orchestrators** — Multi-agent / chain runtimes
6. **Context Windows** — Tokenizers and context budgeting
7. **Prompt Templates** — Templating engines
8. **Logging and Telemetry** — Observability for LLM apps
9. **API Integrations** — Provider SDKs and gateways

## Refreshing the catalog

The seed catalog in `data/catalog.json` is curated by hand. To refresh it
from the npm registry (and optionally GitHub, when `GITHUB_TOKEN` is set):

```bash
npm run catalog:build
```

The script queries the npm registry for each category, merges in the curated
seeds, and rewrites `data/catalog.json`. Each entry is tagged with a
`popularity_hint` (0-100) and a `recency_hint` (ISO date) that the AI uses
for scoring. The script is read-only — it never touches your project.

---

## 🛠 Advanced: install the MCP server (optional)

The MCP server is for users who want **live catalog refresh**, an **in-IDE
dashboard**, and **one-click install** from inside their agent. The prompt
above is the recommended path; this section is for power users.

### Install and run

```bash
npm install
npm run build:all
npm start            # web UI on http://localhost:3847
```

On Windows: `scripts\setup.cmd`. On macOS/Linux: `bash scripts/setup.sh`.

### Connect to your agent

Add the ToolHunt MCP server to your agent's config:

**Kiro — `.kiro/mcp.json`**
```json
{
  "mcpServers": {
    "toolhunt": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Claude Code — `.claude/mcp.json`**
```json
{
  "mcpServers": {
    "toolhunt": {
      "command": "node",
      "args": ["dist/mcp/server.js"]
    }
  }
}
```

Use an absolute path to `dist/mcp/server.js` if your agent runs from a
different working directory.

### Optional API keys

| Variable | Effect |
|----------|--------|
| `GITHUB_TOKEN` | Raises GitHub search rate limit from ~10/min to 5000/hour. |
| `SMITHERY_API_KEY` | Adds the Smithery MCP registry as a source. |
| `TAVILY_API_KEY` | Adds live web search for newly released tools. |

All three are optional. ToolHunt works with zero configuration using the npm
registry alone. See [`.env.example`](.env.example).

### REST API

The web server (port 3847, falling back to 3848/3849) exposes:
- `GET  /api/status`
- `POST /api/scan` — body `{"project_path": "..."}`
- `GET  /api/recommendations`
- `POST /api/install`
- `GET  /api/tools`

### Project layout

```
src/
  mcp/        MCP server + the four tools
  sources/    npm, GitHub, Smithery, Tavily connectors
  analyzer/   project scanner + stack detector
  installer/  tool installer + config updater
  web/        Express server + REST API
  storage/    lowdb persistence
  core/       scan orchestration
ui/           React + Vite + Tailwind frontend
data/         catalog.json, stack-profiles.json, scoring-rubric.md
scripts/      build-catalog.mjs, setup.cmd, setup.sh
```

---

## 🛡 Safety

- Reads only `.env` key names, never values.
- Never deletes project files.
- Never overwrites an existing MCP config entry without confirmation.
- All external calls time out (5s for registries, 10s for web search) and
  fall back gracefully.

## 🤝 Contributing

Issues and pull requests are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, conventions, and how to add
a new tool source or category. Before opening a PR, run:

```bash
npm run typecheck
npm test
```

CI runs build + tests on Node 20 and 22.

## License

[MIT](LICENSE) © ToolHunt contributors
