# ToolHunt — Kiro Setup Prompt

> Bu dosyayı Kiro'ya yapıştır. Kiro projeyi sıfırdan kuracak.

---

## KIRO PROMPT (Yapıştır ve Çalıştır)

```
You are a senior full-stack engineer. Build a production-ready project called **ToolHunt** from scratch. Follow every instruction exactly. Do not add unrequested features. After each major step output: ✅ [step completed].

---

## PROJECT OVERVIEW

ToolHunt is an MCP server that AI agents (Kiro, Claude Code, OpenCode, Cursor, etc.) connect to. When an agent connects, ToolHunt:
1. Analyzes the currently open project (reads files, structure, dependencies, README)
2. Searches multiple live sources for compatible tools: MCP servers, AI SDKs, agent frameworks, vector DBs, orchestrators, prompt templates, logging tools, API integrations
3. Returns a ranked list of recommended tools with install instructions
4. On user approval, installs the selected tools into the project automatically

The agent never needs to leave its IDE. ToolHunt works as a background MCP server.

---

## TECH STACK

- **Runtime:** Node.js 20+ with TypeScript
- **MCP Server:** @modelcontextprotocol/sdk (latest)
- **Web search:** Tavily API (free tier) for live tool discovery
- **Scraping/fetching:** Cheerio + node-fetch for mcp.so, smithery.ai, GitHub awesome lists
- **Web UI:** React + Vite + TailwindCSS (dark theme, TinyFish-style setup flow)
- **Local server:** Express.js to serve the web UI and REST endpoints
- **Storage:** lowdb (JSON file, no external DB needed)
- **Package manager:** npm

---

## PROJECT STRUCTURE

```
toolhunt/
├── src/
│   ├── mcp/
│   │   ├── server.ts          # MCP server entry point
│   │   ├── tools/
│   │   │   ├── analyze.ts     # Analyzes open project
│   │   │   ├── search.ts      # Searches tool sources
│   │   │   ├── recommend.ts   # Ranks and filters results
│   │   │   └── install.ts     # Installs approved tools
│   ├── sources/
│   │   ├── mcpso.ts           # Scraper for mcp.so
│   │   ├── smithery.ts        # Scraper for smithery.ai
│   │   ├── github.ts          # GitHub awesome-mcp lists fetcher
│   │   └── websearch.ts       # Tavily web search for new tools
│   ├── analyzer/
│   │   ├── projectScanner.ts  # Reads project files and detects stack
│   │   └── stackDetector.ts   # Detects: language, framework, DB, infra
│   ├── installer/
│   │   └── toolInstaller.ts   # npm/pip install + config file updater
│   ├── web/
│   │   ├── server.ts          # Express server for UI
│   │   └── api.ts             # REST API routes
│   └── types/
│       └── index.ts           # Shared TypeScript types
├── ui/                        # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── SetupFlow.tsx      # TinyFish-style onboarding
│   │   │   ├── ToolCard.tsx       # Individual tool recommendation card
│   │   │   ├── InstallStatus.tsx  # Live install progress
│   │   │   └── AgentSelector.tsx  # Hermes/Claude/Kiro/Any agent tabs
│   │   └── pages/
│   │       ├── Connect.tsx        # "Connect your Agent" page
│   │       └── Dashboard.tsx      # Tool recommendations dashboard
├── scripts/
│   └── setup.sh               # One-command setup script
├── .toolhunt/
│   └── db.json                # Local storage for discovered tools
├── package.json
├── tsconfig.json
├── README.md
└── AGENT_SETUP.md             # Prompt file for any AI agent to install ToolHunt
```

---

## STEP-BY-STEP BUILD INSTRUCTIONS

### STEP 1 — Initialize Project
- Create the directory structure above
- Initialize npm with `npm init -y`
- Install all dependencies:
  ```
  npm install @modelcontextprotocol/sdk express cors cheerio node-fetch lowdb tavily-js
  npm install -D typescript @types/node @types/express ts-node nodemon vite react react-dom @vitejs/plugin-react tailwindcss
  ```
- Configure tsconfig.json for Node 20, ESM modules

### STEP 2 — MCP Server (src/mcp/server.ts)
Build an MCP server with these 4 tools:

**Tool 1: `analyze_project`**
- Input: `project_path` (string, the root folder of the open project)
- Action: Reads package.json, requirements.txt, Cargo.toml, go.mod, README.md, .env files, directory structure (max 3 levels deep)
- Output: JSON with detected stack: `{ language, framework, database, infrastructure, existing_tools, project_type }`

**Tool 2: `search_tools`**
- Input: `stack` (JSON from analyze_project output)
- Action: Searches ALL of these sources in parallel:
  - mcp.so — scrape tool listings
  - smithery.ai — scrape tool listings  
  - GitHub: fetch raw content of these URLs:
    - https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md
    - https://raw.githubusercontent.com/wong2/awesome-mcp-servers/main/README.md
  - Tavily web search: query = `"MCP server" OR "AI tool" for [framework] [language] 2024 2025`
- Output: Array of tools with: `{ name, description, source, url, install_command, category, relevance_score }`

**Tool 3: `get_recommendations`**
- Input: `tools` array + `stack` JSON
- Action: Score each tool 0-100 based on:
  - Stack match (does it support detected language/framework?)
  - Category coverage (which of the 9 categories does it fill?)
  - Popularity (GitHub stars if available)
  - Recency (newer = higher score)
- Output: Top 10 tools grouped by category, sorted by relevance_score desc

**Tool 4: `install_tool`**
- Input: `tool_name`, `install_command`, `project_path`, `config_type` (mcp_json | package_json | env | manual)
- Action:
  - Run install_command in project_path (npm install / pip install / etc.)
  - If config_type is mcp_json: update .cursor/mcp.json or .kiro/mcp.json with server entry
  - If config_type is package_json: update package.json scripts
  - Output success/failure with logs
- STOP and ask user before any file deletion or overwrite of existing config

### STEP 3 — Tool Sources (src/sources/)

**mcpso.ts:** Fetch and parse https://mcp.so — extract tool name, description, install command, GitHub URL

**smithery.ts:** Fetch and parse https://smithery.ai — extract tool listings

**github.ts:** Fetch the awesome-mcp README files. Parse markdown tables and bullet lists. Extract: tool name, description, GitHub URL, category

**websearch.ts:** Use Tavily API to search for:
- `"MCP server" [stack.framework] [stack.language]`
- `"AI agent tool" [stack.project_type]`
- `"vector database" [stack.language]` (if no vector DB detected)
Return top 5 results per query with title, url, snippet

### STEP 4 — Project Analyzer (src/analyzer/)

**projectScanner.ts:**
- Read and parse: package.json, requirements.txt, Cargo.toml, go.mod, composer.json
- List top-level directories and src/ subdirectories
- Read README.md first 100 lines
- Read .env file keys only (NOT values — privacy)
- Output combined raw data

**stackDetector.ts:** From raw data, detect and return:
```typescript
{
  language: "typescript" | "python" | "rust" | "go" | "other",
  framework: string,        // "nextjs" | "fastapi" | "express" | "none" | etc.
  database: string,         // "postgres" | "mongodb" | "sqlite" | "none" | etc.
  infrastructure: string,   // "docker" | "vercel" | "aws" | "none" | etc.
  existing_tools: string[], // already installed MCP servers or AI tools
  project_type: string,     // "web-app" | "api" | "cli" | "data-pipeline" | "ai-agent" | etc.
  missing_categories: string[] // which of the 9 categories are not yet covered
}
```

### STEP 5 — Web UI (ui/)

Build a React + Tailwind dark-theme UI with these two pages:

**Page 1: Connect (/connect)**
Replicate the TinyFish setup flow from the reference image:
- Header: "TOOLHUNT SETUP" (small caps) + "Connect your Agent" (h1)
- Subtitle: "ToolHunt analyzes your project and finds the right AI tools — search, recommend, and install automatically."
- Agent selector tabs: Kiro | Claude Code | Cursor | OpenCode | Any Agent
- Each tab shows specific MCP config instructions for that agent
- "Copy Setup Prompt" orange button
- Expandable "View prompt" section showing the raw MCP config JSON
- Bottom card: "Setup Complete" with green checkmark when MCP server is detected

**Page 2: Dashboard (/)**
- Top bar: Project name + detected stack badges (React, Node, PostgreSQL etc.)
- 9 category sections: MCP Tools | Skills | Agents | Memory | Orchestrators | Context | Prompts | Logging | APIs
- Each section shows tool cards with: name, description, source badge, relevance score, Install button
- Install button triggers install_tool MCP call, shows live progress
- "Scan Project" button triggers analyze_project + search_tools + get_recommendations
- Installed tools show green checkmark

### STEP 6 — Express Server (src/web/)

- Serve React UI build on port 3847
- REST API endpoints:
  - GET /api/status — server health + MCP connection status
  - POST /api/scan — triggers project analysis
  - GET /api/recommendations — returns cached recommendations
  - POST /api/install — installs a tool
  - GET /api/tools — lists all discovered tools

### STEP 7 — Setup Script (scripts/setup.sh)

```bash
#!/bin/bash
echo "🎣 Installing ToolHunt..."
npm install
npm run build
npm run build:ui
echo "✅ ToolHunt installed. Run: npm start"
echo "📋 Open http://localhost:3847 to connect your agent"
```

### STEP 8 — README.md

Write a clear README with:
- One-line description
- Quick install (3 commands)
- MCP config JSON for: Kiro, Claude Code, Cursor, OpenCode
- Screenshot placeholder
- How it works (3 steps)
- The 9 supported tool categories
- Contributing section

### STEP 9 — AGENT_SETUP.md

Write the universal agent setup prompt file. This file is what any AI agent pastes to install ToolHunt into any project. Content:

```
You are setting up ToolHunt in this project. ToolHunt is an MCP server that analyzes this project and recommends the right AI tools.

Steps:
1. Check if Node.js 20+ is installed. If not, tell the user to install it.
2. Clone ToolHunt: git clone https://github.com/[username]/toolhunt .toolhunt-install
3. Run: cd .toolhunt-install && npm install && npm run build && npm run build:ui
4. Add ToolHunt to this project's MCP config:
   - For Kiro: add to .kiro/mcp.json
   - For Claude Code: add to .claude/mcp.json  
   - For Cursor: add to .cursor/mcp.json
   - Config entry: { "toolhunt": { "command": "node", "args": [".toolhunt-install/dist/mcp/server.js"] } }
5. Start ToolHunt web UI: cd .toolhunt-install && npm start
6. Open http://localhost:3847 to see tool recommendations for this project
7. Confirm setup is complete by calling the analyze_project MCP tool with the current project path.

Do not modify any existing project files except the MCP config file. Stop and ask before any destructive action.
```

---

## CONSTRAINTS

- NEVER read .env values, only keys
- NEVER delete existing project files
- NEVER overwrite existing MCP configs without asking
- ALL external API calls must have 5 second timeouts with graceful fallback
- If Tavily API key is not set, skip web search and use only scraped sources
- Web UI port 3847 — if occupied, try 3848, 3849
- TypeScript strict mode ON
- All async functions must have try/catch

---

## DELIVERABLES CHECKLIST

After completing all steps, verify:
- [ ] `npm start` launches MCP server + web UI
- [ ] MCP server responds to all 4 tool calls
- [ ] Web UI loads on http://localhost:3847
- [ ] analyze_project correctly detects stack from a sample Next.js project
- [ ] search_tools returns results from at least 2 sources
- [ ] install_tool successfully installs a test npm package
- [ ] README.md contains working MCP config for Kiro and Claude Code
- [ ] AGENT_SETUP.md is complete and self-contained

Begin with STEP 1. Output ✅ after each step. Stop and ask before any action that could delete or overwrite files.
```

---

## PROJE PLANI (Türkçe Özet)

### Ne İnşa Ediyoruz?
ToolHunt — bir MCP sunucusu. Kiro, Claude Code, Cursor gibi tüm AI agentlar buna bağlanıyor. Bağlandıklarında:
1. Açık projeyi analiz ediyor (dil, framework, DB, mevcut araçlar)
2. 4 kaynaktan uygun araçları arıyor: mcp.so, smithery.ai, GitHub listeleri, web araması
3. 9 kategoride araç öneriyor, puanlıyor
4. Onay sonrası otomatik kuruyor

### 9 Araç Kategorisi
| Kategori | Ne Arar |
|----------|---------|
| MCP Tools | Projeye uygun MCP sunucuları |
| Skills | Agent yetenekleri, custom tools |
| Agents | Framework'e uygun agent kütüphaneleri |
| Memory | Vector DB'ler (Pinecone, Weaviate vs.) |
| Orchestrators | LangGraph, CrewAI, AutoGen vs. |
| Context Windows | Context yönetim araçları |
| Prompt Templates | Hazır prompt şablonları |
| Logging & Telemetry | LLM izleme araçları |
| API Integrations | Proje için uygun API'ler |

### Akış
```
Agent → analyze_project → search_tools → get_recommendations → [Kullanıcı onaylar] → install_tool
```

### Neden Büyük Potansiyel?
- Şu an böyle bir araç yok
- Tüm vibe coding kullanıcıları (Kiro, Cursor, Claude Code) hedef kitle
- Araçlar sürekli güncelleniyor — ToolHunt her zaman güncel
- Bir kez kur, her projede çalışır
