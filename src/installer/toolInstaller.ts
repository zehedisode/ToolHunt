import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { InstallOutcome, InstallRequest, Result } from "../types/index.js";
import { ok, err } from "../types/index.js";

const INSTALL_TIMEOUT_MS = 300000; // 300 seconds

const MCP_CONFIG_PATHS: Record<NonNullable<InstallRequest["agent"]>, string> = {
  kiro: path.join(".kiro", "mcp.json"),
  claude: path.join(".claude", "mcp.json"),
  cursor: path.join(".cursor", "mcp.json"),
};

const VALID_CONFIG_TYPES = new Set(["mcp_json", "package_json", "env", "manual"]);

/** Run a shell command in a working directory with a hard timeout. */
function runCommand(
  command: string,
  cwd: string,
): Promise<{ code: number | null; logs: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellFlag = isWindows ? "/c" : "-c";
    const child = spawn(shell, [shellFlag, command], { cwd });

    let logs = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, INSTALL_TIMEOUT_MS);

    child.stdout.on("data", (d) => (logs += d.toString()));
    child.stderr.on("data", (d) => (logs += d.toString()));
    child.on("error", (e) => {
      logs += `\n${e.message}`;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, logs, timedOut });
    });
  });
}

interface McpJson {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Add an MCP server entry. If the file does not exist it is created without
 * confirmation. If the entry already exists, the caller must pass
 * allowOverwrite=true; otherwise this returns needsConfirmation so the agent
 * can prompt the user. Never deletes the file.
 */
async function updateMcpConfig(
  projectPath: string,
  agent: NonNullable<InstallRequest["agent"]>,
  toolName: string,
  installCommand: string,
  allowOverwrite: boolean,
): Promise<Result<{ created: boolean; needsConfirmation?: boolean }>> {
  const relPath = MCP_CONFIG_PATHS[agent];
  const fullPath = path.join(projectPath, relPath);
  const dir = path.dirname(fullPath);

  let existing: McpJson = {};
  let fileExisted = false;
  try {
    const content = await fs.readFile(fullPath, "utf8");
    fileExisted = true;
    try {
      existing = JSON.parse(content) as McpJson;
    } catch {
      return err(`Existing MCP config at ${relPath} is not valid JSON; refusing to modify it.`);
    }
  } catch {
    fileExisted = false;
  }

  existing.mcpServers ||= {};
  const servers = existing.mcpServers as Record<string, unknown>;

  if (toolName in servers && !allowOverwrite) {
    // Requirement 8.3: do not overwrite an existing entry without confirmation.
    return ok({ created: false, needsConfirmation: true });
  }

  // Derive a reasonable server entry from the install command.
  servers[toolName] = buildServerEntry(installCommand);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    return ok({ created: !fileExisted });
  } catch (error) {
    return err(
      `Failed to write MCP config at ${relPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildServerEntry(installCommand: string): Record<string, unknown> {
  // Best-effort: turn "npx -y pkg" into a launch command, else store as note.
  const npxMatch = installCommand.match(/npx\s+(-y\s+)?(.+)$/);
  if (npxMatch) {
    const args = npxMatch[2].trim().split(/\s+/);
    return { command: "npx", args: ["-y", ...args], disabled: false, autoApprove: [] };
  }
  return { command: "npx", args: ["-y", installCommand.replace(/^npm install\s+/, "").trim()], disabled: false, autoApprove: [] };
}

async function updatePackageJsonScript(
  projectPath: string,
  toolName: string,
  installCommand: string,
): Promise<Result<void>> {
  const fullPath = path.join(projectPath, "package.json");
  try {
    const content = await fs.readFile(fullPath, "utf8");
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
    pkg.scripts ||= {};
    const scriptName = `toolhunt:${toolName}`.replace(/[^a-z0-9:_-]/gi, "-");
    pkg.scripts[scriptName] = installCommand;
    await fs.writeFile(fullPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    return ok(undefined);
  } catch (error) {
    return err(
      `Failed to update package.json scripts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Install an approved tool and update the appropriate configuration file.
 * Validates inputs, runs the install command (300s cap), then updates config.
 * Never deletes files. Returns needsConfirmation when an MCP entry would be
 * overwritten (unless allowOverwrite is set).
 */
export async function installTool(
  request: InstallRequest,
  options: { allowOverwrite?: boolean } = {},
): Promise<Result<InstallOutcome & { needsConfirmation?: boolean }>> {
  const { tool_name, install_command, project_path, config_type } = request;

  if (!tool_name || !install_command || !project_path || !config_type) {
    return err("install_tool requires tool_name, install_command, project_path, and config_type");
  }
  if (!VALID_CONFIG_TYPES.has(config_type)) {
    return err(`Unsupported config_type: ${config_type}`);
  }

  try {
    const stat = await fs.stat(project_path);
    if (!stat.isDirectory()) {
      return err(`project_path is not a directory: ${project_path}`);
    }
  } catch {
    return err(`project_path does not exist: ${project_path}`);
  }

  // Execute the install command.
  let logs = "";
  try {
    const result = await runCommand(install_command, project_path);
    logs = result.logs;
    if (result.timedOut) {
      return ok({
        tool_name,
        installed: false,
        config_updated: false,
        logs: `${logs}\nInstallation aborted: exceeded ${INSTALL_TIMEOUT_MS}ms timeout.`,
      });
    }
    if (result.code !== 0) {
      return ok({
        tool_name,
        installed: false,
        config_updated: false,
        logs: `${logs}\nInstall command exited with code ${result.code}.`,
      });
    }
  } catch (error) {
    return err(
      `Failed to run install command: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Update configuration based on config_type.
  if (config_type === "mcp_json") {
    const agent = request.agent ?? "kiro";
    const cfg = await updateMcpConfig(
      project_path,
      agent,
      tool_name,
      install_command,
      options.allowOverwrite ?? false,
    );
    if (!cfg.ok) {
      return ok({ tool_name, installed: true, config_updated: false, logs: `${logs}\n${cfg.error}` });
    }
    if (cfg.data.needsConfirmation) {
      return ok({
        tool_name,
        installed: true,
        config_updated: false,
        needsConfirmation: true,
        logs: `${logs}\nAn MCP entry named "${tool_name}" already exists. Confirm overwrite to proceed.`,
      });
    }
    return ok({ tool_name, installed: true, config_updated: true, logs });
  }

  if (config_type === "package_json") {
    const upd = await updatePackageJsonScript(project_path, tool_name, install_command);
    if (!upd.ok) {
      return ok({ tool_name, installed: true, config_updated: false, logs: `${logs}\n${upd.error}` });
    }
    return ok({ tool_name, installed: true, config_updated: true, logs });
  }

  // env / manual: nothing to write automatically.
  return ok({ tool_name, installed: true, config_updated: false, logs });
}
