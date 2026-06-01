export type AgentId = "kiro" | "claude" | "cursor" | "opencode" | "any";

export interface AgentConfig {
  id: AgentId;
  label: string;
  configPath: string;
  /** Raw MCP config JSON shown in the "View prompt" section. */
  mcpJson: string;
  /** Setup prompt copied to clipboard. */
  setupPrompt: string;
}

const serverEntry = `{
  "mcpServers": {
    "toolhunt": {
      "command": "node",
      "args": [".toolhunt-install/dist/mcp/server.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}`;

function prompt(configPath: string): string {
  return `You are setting up ToolHunt in this project. ToolHunt is an MCP server that analyzes this project and recommends the right AI tools.

1. Ensure Node.js 20+ is installed.
2. Clone ToolHunt: git clone https://github.com/zehedisode/ToolHunt.git .toolhunt-install
3. Build it: cd .toolhunt-install && npm install && npm run build && npm run build:ui
4. Add this entry to ${configPath}:
${serverEntry}
5. Start the UI: cd .toolhunt-install && npm start (open http://localhost:3847)
6. Verify by calling the analyze_project MCP tool with this project's path.

Do not modify any existing project files except the MCP config. Stop and ask before any destructive action.`;
}

export const AGENT_CONFIGS: AgentConfig[] = [
  { id: "kiro", label: "Kiro", configPath: ".kiro/mcp.json", mcpJson: serverEntry, setupPrompt: prompt(".kiro/mcp.json") },
  { id: "claude", label: "Claude Code", configPath: ".claude/mcp.json", mcpJson: serverEntry, setupPrompt: prompt(".claude/mcp.json") },
  { id: "cursor", label: "Cursor", configPath: ".cursor/mcp.json", mcpJson: serverEntry, setupPrompt: prompt(".cursor/mcp.json") },
  { id: "opencode", label: "OpenCode", configPath: "opencode.json", mcpJson: serverEntry, setupPrompt: prompt("opencode.json") },
  { id: "any", label: "Any Agent", configPath: "your agent's MCP config", mcpJson: serverEntry, setupPrompt: prompt("your agent's MCP config") },
];
