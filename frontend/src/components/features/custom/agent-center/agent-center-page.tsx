import React from "react";
import { useNavigate } from "react-router";
import {
  AgentService,
  type AgentInfo,
} from "#/api/custom-skill-service/agent-service.api";
import { AgentCard } from "./agent-card";

export function AgentCenterPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = React.useState<AgentInfo[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [categories, setCategories] = React.useState<string[]>([]);
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Create form state
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [newPrompt, setNewPrompt] = React.useState("");
  const [newTags, setNewTags] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const fetchAgents = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const data = await AgentService.listAgents(params);
      setAgents(data.agents);
      setTotal(data.total);
    } catch (e) {
      console.error("Failed to load agents:", e);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  React.useEffect(() => {
    AgentService.getCategories().then(setCategories).catch(() => {});
    AgentService.listFavorites()
      .then((data) => setFavorites(new Set(data.agents.map((a) => a.id))))
      .catch(() => {});
  }, []);

  const handleToggleFavorite = async (agentId: string) => {
    try {
      const result = await AgentService.toggleFavorite(agentId);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (result.is_favorited) next.add(agentId);
        else next.delete(agentId);
        return next;
      });
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await AgentService.createAgent({
        name: newName,
        description: newDesc || undefined,
        system_prompt: newPrompt || undefined,
        category: newCategory || undefined,
        tags,
      });
      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      setNewCategory("");
      setNewPrompt("");
      setNewTags("");
      fetchAgents();
    } catch (e) {
      console.error("Failed to create agent:", e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 text-white overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agent 中心</h1>
          <p className="text-sm text-gray-400 mt-1">
            共 {total} 个 Agent
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
        >
          + 创建 Agent
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="搜索 Agent 名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-gray-500 mb-2">暂无 Agent</p>
          <p className="text-gray-600 text-sm">
            点击"创建 Agent"开始配置你的第一个 Agent
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isFavorited={favorites.has(agent.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">创建 Agent</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  名称 *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：性能分析 Agent"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Agent 的功能描述"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  分类
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="例如：performance, development"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  标签（逗号分隔）
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="例如：perfetto, android, trace"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  系统提示词
                </label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  rows={4}
                  placeholder="Agent 的系统提示词，定义其行为和能力..."
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {creating ? "创建中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
