import React from "react";
import { useNavigate } from "react-router";
import type { AgentInfo } from "#/api/custom-skill-service/agent-service.api";
import { cn } from "#/utils/utils";

interface AgentCardProps {
  agent: AgentInfo;
  onToggleFavorite?: (agentId: string) => void;
  isFavorited?: boolean;
}

export function AgentCard({ agent, onToggleFavorite, isFavorited }: AgentCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "bg-[#161b22] border border-[#30363d] rounded-lg p-4 cursor-pointer",
        "hover:border-blue-500/50 transition-colors",
        !agent.is_enabled && "opacity-60",
      )}
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-white font-semibold text-base truncate flex-1">
          {agent.name}
        </h3>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {!agent.is_enabled && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400">
              已停用
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(agent.id);
              }}
              className="text-gray-500 hover:text-yellow-400 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={isFavorited ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="2"
                className={isFavorited ? "text-yellow-400" : ""}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-3 min-h-[2.5rem]">
        {agent.description || "暂无描述"}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        {agent.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400"
          >
            {tag}
          </span>
        ))}
        {agent.tags.length > 3 && (
          <span className="text-xs text-gray-500">+{agent.tags.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{agent.created_by || "unknown"}</span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          {agent.usage_count}
        </span>
      </div>
    </div>
  );
}
