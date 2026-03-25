/* eslint-disable i18next/no-literal-string, no-nested-ternary, jsx-a11y/control-has-associated-label */
import React from "react";
import {
  AgentService,
  type AgentInfo,
} from "#/api/custom-skill-service/agent-service.api";

interface Props {
  disabled: boolean;
  onSelectAgent: (agent: AgentInfo) => void;
}

export function AgentSelector({ disabled, onSelectAgent }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [agents, setAgents] = React.useState<AgentInfo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await AgentService.listAgents({
        is_enabled: true,
        limit: 50,
      });
      setAgents(res.agents);
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) fetchAgents();
    setIsOpen(!isOpen);
  };

  const handleSelect = (agent: AgentInfo) => {
    onSelectAgent(agent);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title="选择 Agent"
        className={`w-[28px] h-[28px] rounded flex items-center justify-center transition ${
          disabled
            ? "text-gray-600 cursor-not-allowed"
            : isOpen
              ? "text-[#4ECDC4] bg-[#4ECDC4]/10"
              : "text-gray-400 hover:text-white hover:bg-[#333]"
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-[340px] max-h-[400px] bg-[#24272E] border border-[#444] rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[#333] flex items-center justify-between">
            <span className="text-sm font-medium text-white">选择 Agent</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                加载中...
              </div>
            ) : agents.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                暂无可用 Agent
              </div>
            ) : (
              agents.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  onClick={() => handleSelect(agent)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#2a2d35] transition border-b border-[#1a1d24] last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {agent.name}
                    </span>
                    {agent.category && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#333] text-gray-300 rounded">
                        {agent.category}
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {agent.description}
                    </p>
                  )}
                  {agent.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {agent.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1 py-0.5 bg-blue-900/30 text-blue-400 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
