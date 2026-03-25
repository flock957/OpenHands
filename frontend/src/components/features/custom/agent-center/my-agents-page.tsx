/* eslint-disable i18next/no-literal-string, no-nested-ternary */
import React from "react";
import { useNavigate } from "react-router";
import {
  AgentService,
  type AgentInfo,
} from "#/api/custom-skill-service/agent-service.api";

export function MyAgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = React.useState<AgentInfo[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchFavorites = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await AgentService.listFavorites();
      setAgents(res.agents);
    } catch (e) {
      console.error("Failed to load favorites:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleUnfavorite = async (agentId: string) => {
    try {
      await AgentService.toggleFavorite(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (e) {
      console.error("Failed to unfavorite:", e);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 text-white overflow-auto custom-scrollbar">
      <h1 className="text-xl font-bold mb-6">我的 Agent</h1>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          加载中...
        </div>
      ) : agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <p>暂无收藏的 Agent</p>
          <button
            type="button"
            onClick={() => navigate("/agents")}
            className="mt-4 text-blue-400 hover:underline text-sm"
          >
            前往 Agent 中心收藏
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => navigate(`/agents/${agent.id}`)}
              className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#4ECDC4]/50 transition cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-white group-hover:text-[#4ECDC4] transition truncate">
                  {agent.name}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnfavorite(agent.id);
                  }}
                  title="取消收藏"
                  className="text-yellow-400 hover:text-gray-400 transition shrink-0 ml-2"
                >
                  ★
                </button>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                {agent.description || "暂无描述"}
              </p>
              <div className="flex items-center justify-between">
                {agent.category && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#21262d] text-gray-300 rounded">
                    {agent.category}
                  </span>
                )}
                <span className="text-[10px] text-gray-500">
                  {"使用 "}
                  {agent.usage_count}
                  {" 次"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
