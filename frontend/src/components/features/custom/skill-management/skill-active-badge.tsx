interface Props {
  skillName: string;
  onDismiss: () => void;
}

export function SkillActiveBadge({ skillName, onDismiss }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-500/30 rounded-lg animate-in fade-in slide-in-from-bottom-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="text-xs text-blue-300">
        Skill <span className="font-semibold text-blue-200">{skillName}</span> 已激活，正在执行...
      </span>
      <button
        onClick={onDismiss}
        className="text-blue-400/60 hover:text-blue-300 text-sm ml-1 shrink-0"
        title="关闭提示"
      >
        &times;
      </button>
    </div>
  );
}
