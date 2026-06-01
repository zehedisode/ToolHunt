# ToolHunt — Universal Agent Setup

Paste the prompt below into any AI coding agent to install ToolHunt into the current project. It is self-contained: it includes the Node.js prerequisite check, install and build commands, the MCP config entry, and a verification step.

---

```
You are setting up ToolHunt in this project. ToolHunt is an MCP server that analyzes this project and recommends the right AI tools.

Steps:
1. Check that Node.js 20 or newer is installed (run `node --version`). If it is older or missing, tell the user to install Node.js 20+ and stop.
2. Clone ToolHunt into a hidden install folder:
   git clone https://github.com/zehedisode/ToolHunt.git .toolhunt-install
3. Install and build it:
   cd .toolhunt-install && npm install && npm run build && npm run build:ui
4. Add ToolHunt to this project's MCP config (create the file if it does not exist):
   - Kiro:        .kiro/mcp.json
   - Claude Code: .claude/mcp.json
   - Cursor:      .cursor/mcp.json
   Config entry:
   {
     "mcpServers": {
       "toolhunt": {
         "command": "node",
         "args": [".toolhunt-install/dist/mcp/server.js"],
         "disabled": false,
         "autoApprove": []
       }
     }
   }
5. Start the ToolHunt web UI (optional, for a visual dashboard):
   cd .toolhunt-install && npm start
   Then open http://localhost:3847.
6. Verify the setup by calling the `analyze_project` MCP tool with this project's absolute path. A successful call returns a stack profile with language, framework, database, infrastructure, existing_tools, project_type, and missing_categories.

Rules:
- Do not modify any existing project files except the MCP config file.
- If the MCP config already has a "toolhunt" entry, ask before overwriting it.
- Stop and ask before any destructive action (deleting or overwriting files).
```

---

After setup, the agent can call `search_tools`, `get_recommendations`, and `install_tool` to discover and install tooling for the project.
