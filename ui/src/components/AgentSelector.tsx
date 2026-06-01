import { AGENT_CONFIGS, type AgentId } from "./agentConfigs";

interface Props {
  selected: AgentId;
  onSelect: (id: AgentId) => void;
}

export default function AgentSelector({ selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Agent selector">
      {AGENT_CONFIGS.map((agent) => {
        const active = agent.id === selected;
        return (
          <button
            key={agent.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(agent.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-black"
                : "border border-ink-500 bg-ink-700 text-zinc-300 hover:bg-ink-600"
            }`}
          >
            {agent.label}
          </button>
        );
      })}
    </div>
  );
}
