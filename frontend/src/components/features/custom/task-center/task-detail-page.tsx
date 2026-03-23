import React from "react";
import { useParams, useNavigate } from "react-router";
import { TaskService, type TaskInfo } from "#/api/custom-skill-service/task-service.api";
import { cn } from "#/utils/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-400 border-yellow-700",
  running: "bg-blue-900/30 text-blue-400 border-blue-700",
  completed: "bg-green-900/30 text-green-400 border-green-700",
  failed: "bg-red-900/30 text-red-400 border-red-700",
  cancelled: "bg-gray-700/30 text-gray-400 border-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

// Workflow phases for perf analysis
const WORKFLOW_PHASES = [
  { key: "init", label: "初始化", desc: "启动 Trace Processor" },
  { key: "target", label: "确定目标", desc: "查找前台进程" },
  { key: "range", label: "时间范围", desc: "确定启动时间" },
  { key: "state", label: "状态分析", desc: "主线程状态分布" },
  { key: "branch", label: "分支分析", desc: "条件分析路径" },
  { key: "memory", label: "内存分析", desc: "OOM/GC/内存" },
  { key: "render", label: "渲染分析", desc: "帧率/掉帧" },
  { key: "cleanup", label: "清理", desc: "停止服务" },
  { key: "report", label: "生成报告", desc: "HTML 报告" },
];

function getPhaseStatus(taskStatus: string, phaseIndex: number) {
  if (taskStatus === "completed") return "done";
  if (taskStatus === "failed") return phaseIndex < 4 ? "done" : phaseIndex === 4 ? "error" : "pending";
  if (taskStatus === "running") return phaseIndex < 3 ? "done" : phaseIndex === 3 ? "active" : "pending";
  return "pending";
}

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = React.useState<TaskInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    TaskService.getTask(taskId)
      .then(setTask)
      .catch((e) => console.error("Failed to load task:", e))
      .finally(() => setLoading(false));
  }, [taskId]);

  // Auto-refresh for running tasks
  React.useEffect(() => {
    if (!taskId || task?.status !== "running") return;
    const interval = setInterval(() => {
      TaskService.getTask(taskId).then(setTask).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [taskId, task?.status]);

  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await TaskService.cancelTask(taskId);
      TaskService.getTask(taskId).then(setTask);
    } catch (e) {
      console.error("Failed to cancel:", e);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-500">加载中...</div>;
  }

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <p>任务未找到</p>
        <button type="button" onClick={() => navigate("/tasks")} className="mt-4 text-blue-400 hover:underline">返回任务列表</button>
      </div>
    );
  }

  const duration = task.started_at && (task.completed_at || task.status === "running")
    ? Math.round(((task.completed_at ? new Date(task.completed_at).getTime() : Date.now()) - new Date(task.started_at).getTime()) / 1000)
    : null;

  return (
    <div className="h-full flex flex-col p-6 text-white overflow-auto custom-scrollbar">
      {/* Back */}
      <button type="button" onClick={() => navigate("/tasks")}
        className="text-sm text-gray-400 hover:text-white mb-4 self-start">
        &larr; 返回任务列表
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{task.name || "未命名任务"}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn("text-sm px-3 py-1 rounded border", STATUS_STYLES[task.status])}>
              {STATUS_LABELS[task.status] || task.status}
            </span>
            {task.agent_name && (
              <span className="text-sm text-gray-400">Agent: {task.agent_name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {task.conversation_id && (
            <button type="button" onClick={() => navigate(`/conversations/${task.conversation_id}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
              查看对话
            </button>
          )}
          {task.status === "running" && (
            <button type="button" onClick={handleCancel}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition">
              取消任务
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">任务信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">任务 ID</span>
                <span className="text-gray-300 font-mono text-xs">{task.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建者</span>
                <span className="text-gray-300">{task.created_by || "unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-300">{new Date(task.created_at).toLocaleString("zh-CN")}</span>
              </div>
              {task.started_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">开始时间</span>
                  <span className="text-gray-300">{new Date(task.started_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
              {task.completed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">完成时间</span>
                  <span className="text-gray-300">{new Date(task.completed_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
              {duration !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">耗时</span>
                  <span className="text-gray-300">
                    {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                    {task.status === "running" && " (进行中)"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {task.error_message && (
            <div className="bg-[#161b22] border border-red-900/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-2">错误信息</h3>
              <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono bg-[#0d1117] p-2 rounded">
                {task.error_message}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Execution Flow */}
        <div className="lg:col-span-2">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">执行流程</h3>

            {/* Flow diagram */}
            <div className="flex flex-col gap-1">
              {WORKFLOW_PHASES.map((phase, i) => {
                const status = getPhaseStatus(task.status, i);
                return (
                  <div key={phase.key} className="flex items-center gap-3">
                    {/* Connector line + Node */}
                    <div className="flex flex-col items-center w-8">
                      {i > 0 && (
                        <div className={cn("w-0.5 h-3",
                          status === "done" ? "bg-green-500" : status === "active" ? "bg-blue-500" : status === "error" ? "bg-red-500" : "bg-gray-700")} />
                      )}
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
                        status === "done" ? "bg-green-900/50 border-green-500 text-green-400" :
                        status === "active" ? "bg-blue-900/50 border-blue-500 text-blue-400 animate-pulse" :
                        status === "error" ? "bg-red-900/50 border-red-500 text-red-400" :
                        "bg-gray-800 border-gray-600 text-gray-500")}>
                        {status === "done" ? "✓" : status === "error" ? "✕" : status === "active" ? "●" : i + 1}
                      </div>
                      {i < WORKFLOW_PHASES.length - 1 && (
                        <div className={cn("w-0.5 h-3",
                          status === "done" ? "bg-green-500" : "bg-gray-700")} />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 py-1">
                      <p className={cn("text-sm font-medium",
                        status === "done" ? "text-green-400" :
                        status === "active" ? "text-blue-400" :
                        status === "error" ? "text-red-400" :
                        "text-gray-500")}>
                        {phase.label}
                      </p>
                      <p className="text-xs text-gray-600">{phase.desc}</p>
                    </div>

                    {/* Status indicator */}
                    <span className={cn("text-xs px-2 py-0.5 rounded",
                      status === "done" ? "bg-green-900/30 text-green-500" :
                      status === "active" ? "bg-blue-900/30 text-blue-400" :
                      status === "error" ? "bg-red-900/30 text-red-400" :
                      "bg-gray-800 text-gray-600")}>
                      {status === "done" ? "完成" : status === "active" ? "执行中" : status === "error" ? "失败" : "等待"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time status hint */}
          {task.status === "running" && (
            <div className="mt-4 bg-[#161b22] border border-blue-900/50 rounded-lg p-4 flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shrink-0" />
              <div>
                <p className="text-sm text-blue-400">任务正在执行中</p>
                <p className="text-xs text-gray-500 mt-0.5">每 5 秒自动刷新状态。点击"查看对话"可查看实时输出。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
