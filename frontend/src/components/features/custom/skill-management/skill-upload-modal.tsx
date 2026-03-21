import React from "react";
import SkillService from "#/api/custom-skill-service/skill-service.api";

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export function SkillUploadModal({ onClose, onDone }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [triggers, setTriggers] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".md") || filename.endsWith(".markdown")) return "📄";
    if (filename.endsWith(".py")) return "🐍";
    if (filename.endsWith(".sh") || filename.endsWith(".bash")) return "🔧";
    if (filename.endsWith(".js") || filename.endsWith(".ts")) return "📜";
    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "⚙️";
    return "📎";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Skill 名称不能为空");
      return;
    }
    if (files.length === 0) {
      setError("请至少上传一个文件");
      return;
    }

    // Find main .md file
    const mdFiles = files.filter((f) => f.name.endsWith(".md") || f.name.endsWith(".markdown"));
    if (mdFiles.length === 0) {
      setError("至少需要一个 .md 文件作为 Skill 主指令文件");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description);
      formData.append("category", category);
      formData.append("triggers", triggers);
      formData.append("tags", tags);

      // First .md file as main skill file
      formData.append("skill_file", mdFiles[0]);

      // All other files (including additional .md files) as scripts
      const otherFiles = files.filter((f) => f !== mdFiles[0]);
      for (const f of otherFiles) {
        formData.append("script_files", f);
      }

      await SkillService.uploadSkillFiles(formData);
      onDone();
    } catch (e: any) {
      const msg = e.response?.data?.detail || "上传失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#24272E] rounded-lg w-[600px] max-h-[85vh] overflow-y-auto border border-[#444]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-lg font-semibold text-white">上传 Skill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Skill 名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. android-kernel-analysis"
              className="w-full px-3 py-2 bg-[#1a1d24] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个 Skill 做什么"
              className="w-full px-3 py-2 bg-[#1a1d24] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">分类</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. kernel-analysis"
                className="w-full px-3 py-2 bg-[#1a1d24] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">标签 (逗号分隔)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. android, kernel"
                className="w-full px-3 py-2 bg-[#1a1d24] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">触发器 (逗号分隔)</label>
            <input
              type="text"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
              placeholder="e.g. /kernel-diff, 内核分析"
              className="w-full px-3 py-2 bg-[#1a1d24] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* File upload area */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Skill 文件 <span className="text-red-400">*</span>
            </label>
            <div className="border-2 border-dashed border-[#444] rounded-lg p-4 hover:border-blue-500/50 transition">
              <label className="flex flex-col items-center cursor-pointer">
                <span className="text-2xl mb-1">📁</span>
                <span className="text-sm text-gray-400">点击选择文件（可多选）</span>
                <span className="text-xs text-gray-500 mt-1">支持 .md .py .sh .js .ts .yaml .json 等</span>
                <input
                  type="file"
                  accept=".md,.markdown,.py,.sh,.bash,.js,.ts,.go,.rb,.java,.yaml,.yml,.json,.txt,.cfg,.ini,.toml"
                  multiple
                  onChange={handleFilesChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-gray-400 mb-1">{files.length} 个文件已选择：</div>
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between px-3 py-1.5 bg-[#1a1d24] rounded text-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{getFileIcon(file.name)}</span>
                      <span className="text-gray-300 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      {i === 0 && file.name.endsWith(".md") && (
                        <span className="text-[10px] px-1 py-0.5 bg-blue-900/30 text-blue-400 rounded">
                          主指令
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-gray-500 hover:text-red-400 text-sm ml-2 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#333] hover:bg-[#444] rounded text-sm transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition"
            >
              {loading ? "上传中..." : "确认上传"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
