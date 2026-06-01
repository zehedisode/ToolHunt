import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { installTool } from "../src/installer/toolInstaller.js";

async function tmpProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "toolhunt-test-"));
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "victim", version: "1.0.0", scripts: { dev: "echo hi" } }, null, 2),
  );
  return dir;
}

test("rejects invalid config_type without running the command", async () => {
  const dir = await tmpProject();
  const res = await installTool({
    tool_name: "x",
    install_command: "echo should-not-run",
    project_path: dir,
    // @ts-expect-error testing invalid value
    config_type: "bogus",
  });
  assert.equal(res.ok, false);
  await fs.rm(dir, { recursive: true, force: true });
});

test("rejects a non-existent project_path", async () => {
  const res = await installTool({
    tool_name: "x",
    install_command: "echo x",
    project_path: path.join(os.tmpdir(), "definitely-does-not-exist-xyz"),
    config_type: "package_json",
  });
  assert.equal(res.ok, false);
});

test("missing required parameter is rejected", async () => {
  const dir = await tmpProject();
  const res = await installTool({
    tool_name: "",
    install_command: "echo x",
    project_path: dir,
    config_type: "package_json",
  });
  assert.equal(res.ok, false);
  await fs.rm(dir, { recursive: true, force: true });
});

test("creates a new mcp.json without confirmation and preserves other files", async () => {
  const dir = await tmpProject();
  const sentinel = "keep me\n";
  await fs.writeFile(path.join(dir, "KEEP.txt"), sentinel);

  const res = await installTool({
    tool_name: "demo",
    install_command: process.platform === "win32" ? "cd ." : "true",
    project_path: dir,
    config_type: "mcp_json",
    agent: "kiro",
  });
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.data.config_updated, true);

  const cfg = JSON.parse(await fs.readFile(path.join(dir, ".kiro", "mcp.json"), "utf8"));
  assert.ok("demo" in cfg.mcpServers);
  assert.equal(await fs.readFile(path.join(dir, "KEEP.txt"), "utf8"), sentinel);
  await fs.rm(dir, { recursive: true, force: true });
});

test("overwriting an existing mcp entry requires confirmation", async () => {
  const dir = await tmpProject();
  const cmd = process.platform === "win32" ? "cd ." : "true";
  await installTool({ tool_name: "demo", install_command: cmd, project_path: dir, config_type: "mcp_json", agent: "kiro" });
  const second = await installTool({ tool_name: "demo", install_command: cmd, project_path: dir, config_type: "mcp_json", agent: "kiro" });
  assert.ok(second.ok);
  if (second.ok) assert.equal(second.data.needsConfirmation, true);
  await fs.rm(dir, { recursive: true, force: true });
});

test("failed install command reports installed=false", async () => {
  const dir = await tmpProject();
  const res = await installTool({
    tool_name: "broken",
    install_command: process.platform === "win32" ? "exit 1" : "exit 1",
    project_path: dir,
    config_type: "package_json",
  });
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.data.installed, false);
  await fs.rm(dir, { recursive: true, force: true });
});
