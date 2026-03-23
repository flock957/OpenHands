import React from "react";
import SkillService, { SkillInfo } from "#/api/custom-skill-service/skill-service.api";
import { parseSkillInputs } from "#/utils/parse-skill-inputs";
import { useSkillInputStore } from "#/stores/skill-input-store";

interface Props {
  disabled: boolean;
  onActivateSkill: (skillName: string, triggerMessage: string) => void;
}

export function SkillSelector({ disabled, onActivateSkill }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [skills, setSkills] = React.useState<SkillInfo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { setPending } = useSkillInputStore();

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const res = await SkillService.listSkills({ is_active: true, limit: 50 });
      setSkills(res.results);
    } catch (e) {
      console.error("Failed to fetch skills:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) fetchSkills();
    setIsOpen(!isOpen);
  };

  const handleSelect = async (skill: SkillInfo) => {
    setIsOpen(false);
    const slashTrigger = skill.triggers.find((t) => t.startsWith("/"));

    // Fetch detail FIRST to check for inputs (before activation,
    // so we can set pending before agent state transitions happen)
    let inputs: ReturnType<typeof parseSkillInputs> = [];
    try {
      const detail = await SkillService.getSkill(skill.id);
      inputs = parseSkillInputs(detail.content);
    } catch (e) {
      // Continue without inputs
    }

    // Set pending BEFORE activation so we catch RUNNING → AWAITING_USER_INPUT
    if (inputs.length > 0) {
      setPending({ skillName: skill.name, trigger: slashTrigger, inputs });
    }

    // Now activate the skill
    const triggerMessage = slashTrigger
      ? `Execute skill: ${skill.name} (trigger: ${slashTrigger}). Follow the skill instructions to complete the task.`
      : `Execute skill: ${skill.name}. Follow the skill instructions to complete the task.`;
    onActivateSkill(skill.name, triggerMessage);
  };

  const filtered = search
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.description || "").toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title="选择 Skill"
        className={`w-[28px] h-[28px] rounded flex items-center justify-center transition ${
          disabled
            ? "text-gray-600 cursor-not-allowed"
            : isOpen
              ? "text-blue-400 bg-blue-900/30"
              : "text-gray-400 hover:text-white hover:bg-[#333]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </button>

      {/* Skill list dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-[340px] max-h-[400px] bg-[#24272E] border border-[#444] rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[#333] flex items-center justify-between">
            <span className="text-sm font-medium text-white">选择 Skill</span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-sm">&times;</button>
          </div>
          <div className="px-3 py-2 border-b border-[#333]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 Skill..."
              className="w-full px-2 py-1.5 bg-[#1a1d24] border border-[#444] rounded text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-xs">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                {skills.length === 0 ? "暂无可用 Skill" : "未找到匹配的 Skill"}
              </div>
            ) : (
              filtered.map((skill) => (
                <button
                  type="button"
                  key={skill.id}
                  onClick={() => handleSelect(skill)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#2a2d35] transition border-b border-[#1a1d24] last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{skill.name}</span>
                    <span className="text-[10px] text-gray-500">v{skill.current_version}</span>
                  </div>
                  {skill.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{skill.description}</p>
                  )}
                  {skill.triggers.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {skill.triggers.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-1 py-0.5 bg-[#333] text-gray-300 rounded">{t}</span>
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
