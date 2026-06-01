import type { ToolRecord } from "../types";

export type InstallState = "idle" | "installing" | "installed" | "failed";

interface Props {
  tool: ToolRecord;
  state: InstallState;
  error?: string;
  onInstall: (tool: ToolRecord) => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-zinc-400";
}

export default function ToolCard({ tool, state, error, onInstall }: Props) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={tool.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-semibold text-white hover:text-accent"
            title={tool.name}
          >
            {tool.name}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <span className="badge">{tool.source}</span>
            <span className={`text-xs font-semibold ${scoreColor(tool.relevance_score)}`}>
              {tool.relevance_score}/100
            </span>
          </div>
        </div>
      </div>
      <p className="line-clamp-3 text-sm text-zinc-400">{tool.description}</p>
      <code className="truncate rounded bg-ink-900 px-2 py-1 text-xs text-zinc-500" title={tool.install_command}>
        {tool.install_command}
      </code>
      <div className="mt-auto flex items-center justify-between pt-2">
        {state === "installed" ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
            ✓ Installed
          </span>
        ) : (
          <button
            className="btn-accent"
            disabled={state === "installing"}
            onClick={() => onInstall(tool)}
          >
            {state === "installing" ? "Installing…" : "Install"}
          </button>
        )}
        {state === "failed" && (
          <span className="text-xs text-red-400" title={error}>
            ✕ Failed
          </span>
        )}
      </div>
    </div>
  );
}
