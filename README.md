# 🎣 ToolHunt

An MCP server that analyzes your open project and recommends — then installs — the right AI tools for it. Connect it to Kiro, Claude Code, Cursor, or any MCP-capable agent and never leave your IDE to find tooling.

## Quick install

```bash
npm install
npm run build:all
npm start
```

Then open http://localhost:3847 to connect your agent and review recommendations.

> On Windows you can also run `scripts\setup.cmd`; on macOS/Linux run `bash scripts/setup.sh`.

## MCP configuration

ToolHunt runs as a stdio MCP server. Add one of the entries below to your agent's MCP config.

### Kiro — `.kiro/mcp.json`

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

### Claude Code — `.claude/mcp.json`

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

Use an absolute path to `dist/mcp/server.js` if your agent runs from a different working directory.

## How it works

1. **Analyze** — `analyze_project` reads your manifests, README, env keys (names only), and directory structure to build a stack profile.
2. **Search & recommend** — `search_tools` queries the npm registry and GitHub search (and, if configured, the Smithery registry and Tavily web search) in parallel; `get_recommendations` scores and ranks the results.
3. **Install** — on your approval, `install_tool` runs the install command and wires the tool into your config without overwriting anything or deleting files.

## Tool sources

| Source | Auth | Notes |
|--------|------|-------|
| npm registry | none | Primary source. Clean, structured package data with popularity/quality scores. |
| GitHub search | optional `GITHUB_TOKEN` | Repos with star counts and recency. Token lifts the rate limit from ~10/min to 5000/hour. |
| Smithery registry | `SMITHERY_API_KEY` | Curated MCP servers. Skipped when the key is absent. |
| Tavily web search | `TAVILY_API_KEY` | Discovers newer tools. Skipped when the key is absent. |

ToolHunt works with zero configuration using npm + GitHub. The optional keys add sources and raise rate limits.

## The nine tool categories

1. MCP Tools
2. Skills
3. Agents
4. Memory
5. Orchestrators
6. Context Windows
7. Prompt Templates
8. Logging and Telemetry
9. API Integrations

## MCP tools

| Tool | Purpose |
|------|---------|
| `analyze_project` | Detect the project's language, framework, database, infrastructure, existing tools, and missing categories. |
| `search_tools` | Search all enabled sources in parallel for compatible tools. |
| `get_recommendations` | Score and rank discovered tools; return up to 10 grouped by category. |
| `install_tool` | Install an approved tool and update the right config file. |

## Web search (optional)

Set `TAVILY_API_KEY` to enable live web search, `SMITHERY_API_KEY` to add the Smithery registry, and `GITHUB_TOKEN` to raise the GitHub rate limit (see `.env.example`). None are required — ToolHunt works out of the box with npm + GitHub.

## REST API

The web server (port 3847, falling back to 3848/3849) exposes:

- `GET /api/status`
- `POST /api/scan`
- `GET /api/recommendations`
- `POST /api/install`
- `GET /api/tools`

## Project layout

```
src/
  mcp/        MCP server + the four tools
  sources/    npm registry, GitHub search, Smithery, Tavily connectors
  analyzer/   project scanner + stack detector
  installer/  tool installer + config updater
  web/        Express server + REST API
  storage/    lowdb persistence
  core/       scan orchestration
ui/           React + Vite + Tailwind frontend
```

## Safety

- Reads only `.env` key names, never values.
- Never deletes project files.
- Never overwrites an existing MCP config entry without confirmation.
- All external calls time out (5s for registries, 10s for web search) and fall back gracefully.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and how to add a new tool source. Run `npm run typecheck` and `npm test` before opening a PR; CI runs build + tests on Node 20 and 22.

## License

[MIT](LICENSE) © ToolHunt contributors
