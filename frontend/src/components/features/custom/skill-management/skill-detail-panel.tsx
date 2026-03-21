import React from "react";
import SkillService, { SkillDetail, ScriptInfo } from "#/api/custom-skill-service/skill-service.api";

interface FileItem {
  id: string;
  name: string;
  language: string;
  content: string;
  type: "main" | "file";
}

interface Props {
  skill: SkillDetail;
  onDelete: () => void;
  onToggleActive: () => void;
  onRefresh: () => void;
}

function getFileIcon(filename: string) {
  if (filename.endsWith(".md") || filename.endsWith(".markdown")) return "📄";
  if (filename.endsWith(".py")) return "🐍";
  if (filename.endsWith(".sh") || filename.endsWith(".bash")) return "🔧";
  if (filename.endsWith(".js") || filename.endsWith(".ts")) return "📜";
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "⚙️";
  if (filename.endsWith(".json")) return "📋";
  return "📎";
}

function getLanguageLabel(lang: string | null) {
  const map: Record<string, string> = {
    python: "Python",
    bash: "Bash",
    javascript: "JavaScript",
    typescript: "TypeScript",
    markdown: "Markdown",
    yaml: "YAML",
    json: "JSON",
    go: "Go",
    text: "Text",
  };
  return lang ? map[lang] || lang : "Text";
}

export function SkillDetailPanel({ skill, onDelete, onToggleActive, onRefresh }: Props) {
  const [activeTab, setActiveTab] = React.useState<"files" | "versions" | "info">("files");
  const [selectedFileId, setSelectedFileId] = React.useState<string>("main");
  const [uploading, setUploading] = React.useState(false);

  // Build unified file list
  const allFiles: FileItem[] = React.useMemo(() => {
    const files: FileItem[] = [
      {
        id: "main",
        name: skill.name + ".md",
        language: "markdown",
        content: skill.content,
        type: "main",
      },
    ];
    for (const script of skill.scripts) {
      files.push({
        id: script.id,
        name: script.filename,
        language: script.language || "text",
        content: script.content,
        type: "file",
      });
    }
    return files;
  }, [skill]);

  const selectedFile = allFiles.find((f) => f.id === selectedFileId) || allFiles[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append("file", file);
        await SkillService.uploadScript(skill.id, formData);
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to upload files:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (scriptId: string) => {
    if (!confirm("确定删除这个文件吗？")) return;
    try {
      await SkillService.deleteScript(scriptId);
      if (selectedFileId === scriptId) setSelectedFileId("main");
      onRefresh();
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm("确定回滚到这个版本吗？")) return;
    try {
      await SkillService.rollbackVersion(skill.id, versionId);
      onRefresh();
    } catch (err) {
      console.error("Failed to rollback:", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#333] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{skill.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleActive}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                skill.is_active
                  ? "bg-yellow-700/30 text-yellow-400 hover:bg-yellow-700/50"
                  : "bg-green-700/30 text-green-400 hover:bg-green-700/50"
              }`}
            >
              {skill.is_active ? "禁用" : "启用"}
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded text-xs font-medium transition"
            >
              删除
            </button>
          </div>
        </div>
        {skill.description && <p className="text-sm text-gray-400">{skill.description}</p>}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
          <span>v{skill.current_version}</span>
          {skill.category && <span className="px-1.5 py-0.5 bg-[#333] rounded">{skill.category}</span>}
          {skill.triggers.map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded">{t}</span>
          ))}
          {skill.tags.map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-[#333] rounded">{t}</span>
          ))}
          <span>{allFiles.length} 个文件</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333] shrink-0">
        {([
          ["files", `文件 (${allFiles.length})`],
          ["versions", `版本 (${skill.versions.length})`],
          ["info", "信息"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === key
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "files" && (
          <div className="h-full flex">
            {/* File tree */}
            <div className="w-[200px] border-r border-[#333] overflow-y-auto shrink-0">
              <div className="p-2">
                <label className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded cursor-pointer transition">
                  + 添加文件
                  <input
                    type="file"
                    accept=".md,.py,.sh,.js,.ts,.yaml,.yml,.json,.txt,.go,.cfg,.ini,.toml"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {uploading && <div className="text-[10px] text-gray-500 text-center mt-1">上传中...</div>}
              </div>
              {allFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer text-sm transition ${
                    selectedFileId === file.id
                      ? "bg-blue-900/20 text-white border-l-2 border-l-blue-500"
                      : "text-gray-400 hover:bg-[#2a2d35] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    <span className="text-xs shrink-0">{getFileIcon(file.name)}</span>
                    <span className="truncate text-xs">{file.name}</span>
                  </div>
                  {file.type === "file" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* File preview */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* File header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#1a1d24] shrink-0">
                <div className="flex items-center gap-2">
                  <span>{getFileIcon(selectedFile.name)}</span>
                  <span className="text-sm font-medium text-white">{selectedFile.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#333] text-gray-400 rounded">
                    {getLanguageLabel(selectedFile.language)}
                  </span>
                  {selectedFile.type === "main" && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded">
                      主指令
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500">
                  {selectedFile.content.split("\n").length} 行
                </span>
              </div>

              {/* File content with line numbers */}
              <div className="flex-1 overflow-auto bg-[#0d0f13]">
                <div className="flex min-h-full">
                  {/* Line numbers */}
                  <div className="sticky left-0 bg-[#0d0f13] border-r border-[#222] px-2 py-3 select-none shrink-0">
                    {selectedFile.content.split("\n").map((_, i) => (
                      <div key={i} className="text-[11px] text-gray-600 text-right leading-[20px] font-mono">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Code content */}
                  <pre className="flex-1 p-3 text-[12px] text-gray-300 font-mono leading-[20px] whitespace-pre overflow-x-auto">
                    {selectedFile.content}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "versions" && (
          <div className="overflow-y-auto p-6 space-y-3">
            {skill.versions.map((ver) => (
              <div
                key={ver.id}
                className={`p-4 rounded border ${
                  ver.is_current
                    ? "border-blue-500/50 bg-blue-900/10"
                    : "border-[#333] bg-[#1a1d24]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">v{ver.version}</span>
                    {ver.is_current && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-600 rounded">当前</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(ver.created_at).toLocaleString()}
                    </span>
                    {!ver.is_current && (
                      <button
                        onClick={() => handleRollback(ver.id)}
                        className="text-xs px-2 py-1 bg-[#333] hover:bg-[#444] rounded transition"
                      >
                        回滚
                      </button>
                    )}
                  </div>
                </div>
                {ver.changelog && <p className="text-xs text-gray-400 mb-1">变更: {ver.changelog}</p>}
                {ver.performance_notes && (
                  <p className="text-xs text-yellow-400/70">效果: {ver.performance_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "info" && (
          <div className="overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs mb-1">ID</div>
                <div className="text-gray-300 font-mono text-xs">{skill.id}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">类型</div>
                <div className="text-gray-300">{skill.skill_type}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">状态</div>
                <div className={skill.is_active ? "text-green-400" : "text-red-400"}>
                  {skill.is_active ? "已启用" : "已禁用"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">当前版本</div>
                <div className="text-gray-300">v{skill.current_version}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">创建时间</div>
                <div className="text-gray-300 text-xs">{new Date(skill.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">更新时间</div>
                <div className="text-gray-300 text-xs">{new Date(skill.updated_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">文件数</div>
                <div className="text-gray-300">{allFiles.length} 个</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">全局共享</div>
                <div className="text-gray-300">{skill.is_global ? "是" : "否"}</div>
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-xs mb-1">触发器</div>
              <div className="flex flex-wrap gap-1">
                {skill.triggers.length > 0
                  ? skill.triggers.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-blue-900/20 text-blue-400 rounded">{t}</span>
                    ))
                  : <span className="text-gray-500 text-xs">无</span>}
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-xs mb-1">标签</div>
              <div className="flex flex-wrap gap-1">
                {skill.tags.length > 0
                  ? skill.tags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-[#333] text-gray-300 rounded">{t}</span>
                    ))
                  : <span className="text-gray-500 text-xs">无</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
