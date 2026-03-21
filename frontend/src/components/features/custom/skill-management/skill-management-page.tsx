import React from "react";
import SkillService, {
  SkillInfo,
  SkillDetail,
} from "#/api/custom-skill-service/skill-service.api";
import { SkillUploadModal } from "./skill-upload-modal";
import { SkillDetailPanel } from "./skill-detail-panel";

export function SkillManagementPage() {
  const [skills, setSkills] = React.useState<SkillInfo[]>([]);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [selectedSkill, setSelectedSkill] = React.useState<SkillDetail | null>(null);
  const [showUpload, setShowUpload] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const fetchSkills = React.useCallback(async (searchTerm?: string) => {
    setLoading(true);
    try {
      const res = await SkillService.listSkills({
        search: searchTerm || undefined,
        limit: 100,
      });
      setSkills(res.results);
      setTotal(res.total);
    } catch (e) {
      console.error("Failed to fetch skills:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleSearch = () => {
    fetchSkills(search);
  };

  const handleSelectSkill = async (skillId: string) => {
    try {
      const detail = await SkillService.getSkill(skillId);
      setSelectedSkill(detail);
    } catch (e) {
      console.error("Failed to fetch skill detail:", e);
    }
  };

  const handleDelete = async (skillId: string) => {
    if (!confirm("确定删除这个 Skill 吗？所有版本和脚本都会被删除。")) return;
    try {
      await SkillService.deleteSkill(skillId);
      setSelectedSkill(null);
      fetchSkills(search);
    } catch (e) {
      console.error("Failed to delete skill:", e);
    }
  };

  const handleToggleActive = async (skill: SkillInfo) => {
    try {
      await SkillService.updateSkill(skill.id, { is_active: !skill.is_active });
      fetchSkills(search);
      if (selectedSkill?.id === skill.id) {
        const detail = await SkillService.getSkill(skill.id);
        setSelectedSkill(detail);
      }
    } catch (e) {
      console.error("Failed to toggle skill:", e);
    }
  };

  const handleUploadDone = () => {
    setShowUpload(false);
    fetchSkills(search);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1a1d24] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
        <h1 className="text-xl font-semibold">Skill 管理</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition"
        >
          + 上传 Skill
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-[#333]">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索 Skill 名称或描述..."
            className="flex-1 px-3 py-2 bg-[#2a2d35] border border-[#444] rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-[#333] hover:bg-[#444] rounded text-sm transition"
          >
            搜索
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          共 {total} 个 Skill
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Skill List */}
        <div className="w-[360px] border-r border-[#333] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-400">加载中...</div>
          ) : skills.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              暂无 Skill，点击右上角上传
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => handleSelectSkill(skill.id)}
                className={`px-4 py-3 border-b border-[#2a2d35] cursor-pointer hover:bg-[#2a2d35] transition ${
                  selectedSkill?.id === skill.id ? "bg-[#2a2d35] border-l-2 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">v{skill.current_version}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        skill.is_active
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {skill.is_active ? "启用" : "禁用"}
                    </span>
                  </div>
                </div>
                {skill.description && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {skill.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {skill.category && (
                    <span className="text-xs px-1.5 py-0.5 bg-[#333] rounded">
                      {skill.category}
                    </span>
                  )}
                  {skill.triggers.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {skill.triggers.length} 个触发器
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedSkill ? (
            <SkillDetailPanel
              skill={selectedSkill}
              onDelete={() => handleDelete(selectedSkill.id)}
              onToggleActive={() => handleToggleActive(selectedSkill)}
              onRefresh={() => handleSelectSkill(selectedSkill.id)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              选择左侧 Skill 查看详情
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <SkillUploadModal
          onClose={() => setShowUpload(false)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}
