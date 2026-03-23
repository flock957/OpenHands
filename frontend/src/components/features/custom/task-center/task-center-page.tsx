import React from "react";
import { useNavigate } from "react-router";
import {
  TaskService,
  type TaskInfo,
} from "#/api/custom-skill-service/task-service.api";
import { cn } from "#/utils/utils";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "running", label: "运行中" },
  { key: "completed", label: "已完成" },
  { key: "failed", label: "失败" },
  { key: "cancelled", label: "已取消" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-400",
  running: "bg-blue-900/30 text-blue-400",
  completed: "bg-green-900/30 text-green-400",
  failed: "bg-red-900/30 text-red-400",
  cancelled: "bg-gray-700/30 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export function TaskCenterPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = React.useState<TaskInfo[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [search, setSearch] = React.useState("");

  const fetchTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await TaskService.listTasks(params);
      setTasks(data.tasks);
      setTotal(data.total);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCancel = async (taskId: string) => {
    try {
      await TaskService.cancelTask(taskId);
      fetchTasks();
    } catch (e) {
      console.error("Failed to cancel task:", e);
    }
  };

  const handleOpenConversation = (conversationId: string | null) => {
    if (conversationId) {
      navigate(`/conversations/${conversationId}`);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 text-white overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">任务中心</h1>
        <p className="text-sm text-gray-400 mt-1">共 {total} 个任务</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded text-sm transition",
              statusFilter === tab.key
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-[#21262d]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="搜索任务名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Task Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-gray-500 mb-2">暂无任务</p>
          <p className="text-gray-600 text-sm">
            前往 Agent 中心启动一个 Agent 来创建任务
          </p>
          <button
            type="button"
            onClick={() => navigate("/agents")}
            className="mt-3 text-blue-400 hover:underline text-sm"
          >
            前往 Agent 中心
          </button>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-left text-gray-400">
                <th className="px-4 py-3 font-medium">任务名称</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-[#30363d] hover:bg-[#1c2128] transition"
                >
                  <td className="px-4 py-3 text-white">
                    {task.name || "未命名任务"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {task.agent_name || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        STATUS_STYLES[task.status] || STATUS_STYLES.pending,
                      )}
                    >
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(task.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {task.conversation_id && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenConversation(task.conversation_id)
                          }
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          查看对话
                        </button>
                      )}
                      {task.status === "running" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(task.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
