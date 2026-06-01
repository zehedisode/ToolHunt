import { useState } from "react";
import { AGENT_CONFIGS, type AgentId } from "./agentConfigs";
import AgentSelector from "./AgentSelector";

interface Props {
  connected: boolean;
}

export default function SetupFlow({ connected }: Props) {
  const [selected, setSelected] = useState<AgentId>("kiro");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const agent = AGENT_CONFIGS.find((a) => a.id === selected)!;

  async function copyPrompt() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(agent.setupPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">ToolHunt Setup</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Connect your Agent</h1>
      <p className="mt-3 text-zinc-400">
        ToolHunt analyzes your project and finds the right AI tools — search, recommend, and
        install automatically.
      </p>

      <div className="mt-6">
        <AgentSelector selected={selected} onSelect={setSelected} />
      </div>

      <div className="card mt-5">
        <p className="text-sm text-zinc-400">
          Add ToolHunt to <code className="text-zinc-200">{agent.configPath}</code>, then reload
          this page.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-accent" onClick={copyPrompt}>
            {copied ? "✓ Copied" : "Copy Setup Prompt"}
          </button>
          <button className="btn-ghost" onClick={() => setShowPrompt((v) => !v)}>
            {showPrompt ? "Hide config" : "View prompt"}
          </button>
        </div>
        {copyError && (
          <p className="mt-2 text-xs text-red-400">
            Couldn't copy automatically. Select the config below and copy it manually.
          </p>
        )}
        {showPrompt && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs text-zinc-300">
            {agent.mcpJson}
          </pre>
        )}
      </div>

      <div
        className={`card mt-5 flex items-center gap-3 ${
          connected ? "border-emerald-500/40" : ""
        }`}
      >
        <span className={`text-xl ${connected ? "text-emerald-400" : "text-zinc-600"}`}>
          {connected ? "✓" : "○"}
        </span>
        <div>
          <p className="font-semibold text-white">
            {connected ? "Setup Complete" : "Waiting for connection…"}
          </p>
          <p className="text-sm text-zinc-400">
            {connected
              ? "ToolHunt detected a project scan. Head to the Dashboard."
              : "Connect your agent and run a scan. This refreshes automatically."}
          </p>
        </div>
      </div>
    </div>
  );
}
