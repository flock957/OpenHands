import React from "react";
import { useParams, useNavigate } from "react-router";
import {
  AgentService,
  type AgentDetail,
} from "#/api/custom-skill-service/agent-service.api";
import { TaskService } from "#/api/custom-skill-service/task-service.api";

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = React.useState<AgentDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    AgentService.getAgent(agentId)
      .then(setAgent)
      .catch((e) => console.error("Failed to load agent:", e))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleStartAgent = async () => {
    if (!agentId || starting) return;
    setStarting(true);
    try {
      const result = await TaskService.createTask({ agent_id: agentId });
      const prompt = result.agent.system_prompt
        ? `[Agent: ${result.agent.name}]\n\n${result.agent.system_prompt}`
        : `启动 Agent: ${result.agent.name}`;
      sessionStorage.setItem(
        "pending_agent_task",
        JSON.stringify({
          task_id: result.task_id,
          agent_name: result.agent.name,
          system_prompt: prompt,
        }),
      );
      navigate("/");
    } catch (e) {
      console.error("Failed to start agent:", e);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">加载中...</div>
    );
  }

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <p>Agent 未找到</p>
        <button type="button" onClick={() => navigate("/agents")} className="mt-4 text-blue-400 hover:underline">
          返回 Agent 列表
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 text-white overflow-auto custom-scrollbar">
      {/* Back */}
      <button type="button" onClick={() => navigate("/agents")}
        className="text-sm text-gray-400 hover:text-white mb-4 self-start">
        &larr; 返回列表
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-gray-400 mt-1">{agent.description || "暂无描述"}</p>
          <div className="flex gap-2 mt-2">
            {agent.category && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-gray-300">{agent.category}</span>
            )}
            {agent.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400">{t}</span>
            ))}
          </div>
        </div>
        <button type="button" onClick={handleStartAgent} disabled={starting || !agent.is_enabled}
          className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition shrink-0">
          {starting ? "启动中..." : "启动 Agent"}
        </button>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Prompt */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">系统提示词</h3>
          {agent.system_prompt ? (
            <pre className="text-sm text-gray-400 whitespace-pre-wrap font-mono bg-[#0d1117] p-3 rounded max-h-60 overflow-auto custom-scrollbar">
              {agent.system_prompt}
            </pre>
          ) : (
            <p className="text-sm text-gray-500">未配置系统提示词</p>
          )}
        </div>

        {/* Meta Info */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">基本信息</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">状态</span>
              <span className={agent.is_enabled ? "text-green-400" : "text-red-400"}>
                {agent.is_enabled ? "已启用" : "已停用"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">使用次数</span>
              <span className="text-gray-300">{agent.usage_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建者</span>
              <span className="text-gray-300">{agent.created_by || "unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">默认模型</span>
              <span className="text-gray-300">{agent.default_llm_model || "默认"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建时间</span>
              <span className="text-gray-300">{new Date(agent.created_at).toLocaleString("zh-CN")}</span>
            </div>
          </div>
        </div>

        {/* Skill List */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            关联 Skills ({agent.skills.length})
          </h3>
          {agent.skills.length === 0 ? (
            <p className="text-sm text-gray-500">暂未关联任何 Skill</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto custom-scrollbar">
              {agent.skills.map((skill) => (
                <div key={skill.id}
                  className="flex items-start gap-3 p-2 rounded bg-[#0d1117] hover:bg-[#21262d] transition cursor-pointer"
                  onClick={() => navigate("/skill-management")}>
                  <div className="w-8 h-8 rounded bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" className="text-blue-400">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{skill.name}</p>
                    <p className="text-xs text-gray-500 truncate">{skill.description || "暂无描述"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Instructions */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">使用说明</h3>
          {agent.usage_instructions ? (
            <div className="text-sm text-gray-400 whitespace-pre-wrap bg-[#0d1117] p-3 rounded max-h-60 overflow-auto custom-scrollbar">
              {agent.usage_instructions}
            </div>
          ) : (
            <p className="text-sm text-gray-500">暂无使用说明</p>
          )}
        </div>
      </div>
    </div>
  );
}
