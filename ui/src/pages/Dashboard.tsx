import { useCallback, useEffect, useMemo, useState } from "react";
import ToolCard, { type InstallState } from "../components/ToolCard";
import { getRecommendations, install, scan } from "../api";
import {
  TOOL_CATEGORIES,
  type RecommendationGroup,
  type StackProfile,
  type ToolRecord,
} from "../types";

function StackBadges({ stack }: { stack: StackProfile | null }) {
  if (!stack) return null;
  const fields: Array<[string, string]> = [
    ["language", stack.language],
    ["framework", stack.framework],
    ["database", stack.database],
    ["infrastructure", stack.infrastructure],
    ["type", stack.project_type],
  ];
  const visible = fields.filter(([, v]) => v && v !== "none");
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([k, v]) => (
        <span key={k} className="badge">
          {v}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stack, setStack] = useState<StackProfile | null>(null);
  const [groups, setGroups] = useState<RecommendationGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await getRecommendations();
      setStack(data.stack);
      setGroups(data.recommendations);
    } catch {
      // keep previous data
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ToolRecord[]>();
    for (const g of groups) map.set(g.category, g.tools);
    return map;
  }, [groups]);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      const result = await scan();
      if (result.error) {
        setScanError(result.error); // retain previous recommendations
      } else {
        await load();
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  function keyFor(tool: ToolRecord): string {
    return `${tool.source}::${tool.name}`;
  }

  async function handleInstall(tool: ToolRecord) {
    const key = keyFor(tool);
    setInstallStates((s) => ({ ...s, [key]: "installing" }));
    try {
      const result = await install(tool);
      if (result.outcome === "succeeded") {
        setInstallStates((s) => ({ ...s, [key]: "installed" }));
      } else {
        setInstallStates((s) => ({ ...s, [key]: "failed" }));
        setInstallErrors((e) => ({ ...e, [key]: result.error ?? "Install failed" }));
      }
    } catch (e) {
      setInstallStates((s) => ({ ...s, [key]: "failed" }));
      setInstallErrors((err) => ({ ...err, [key]: e instanceof Error ? e.message : String(e) }));
    }
  }

  const totalTools = groups.reduce((n, g) => n + g.tools.length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {stack ? "Detected stack" : "No scan yet — run one to discover tools."}
          </p>
          <div className="mt-3">
            <StackBadges stack={stack} />
          </div>
        </div>
        <button className="btn-accent" onClick={handleScan} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan Project"}
        </button>
      </div>

      {scanError && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Scan failed: {scanError}. Showing previous recommendations.
        </div>
      )}

      <div className="mt-8 space-y-8">
        {TOOL_CATEGORIES.map((category) => {
          const tools = byCategory.get(category) ?? [];
          return (
            <section key={category}>
              <div className="mb-3 flex items-baseline justify-between border-b border-ink-700 pb-2">
                <h2 className="text-lg font-semibold text-white">{category}</h2>
                <span className="text-xs text-zinc-500">{tools.length}</span>
              </div>
              {tools.length === 0 ? (
                <p className="text-sm text-zinc-600">No recommendations in this category.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
                    const key = keyFor(tool);
                    return (
                      <ToolCard
                        key={key}
                        tool={tool}
                        state={installStates[key] ?? "idle"}
                        error={installErrors[key]}
                        onInstall={handleInstall}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {totalTools === 0 && !scanning && (
        <p className="mt-10 text-center text-sm text-zinc-600">
          Run a scan to populate recommendations across all nine categories.
        </p>
      )}
    </div>
  );
}
