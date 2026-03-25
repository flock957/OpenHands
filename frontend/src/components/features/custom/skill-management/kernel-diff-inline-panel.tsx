/* eslint-disable i18next/no-literal-string */
import React from "react";
import { cn } from "#/utils/utils";

interface KernelDiffInlinePanelProps {
  onSubmit: (message: string) => void;
  onDismiss: () => void;
  disabled?: boolean;
}

export function KernelDiffInlinePanel({
  onSubmit,
  onDismiss,
  disabled,
}: KernelDiffInlinePanelProps) {
  const [oldTag, setOldTag] = React.useState("");
  const [newTag, setNewTag] = React.useState("");

  const handleSubmit = () => {
    if (!oldTag.trim() || !newTag.trim()) return;

    const message = [
      `Execute skill: android-kernel-diff-analysis (trigger: /kernel-diff). Follow the skill instructions to complete the task.`,
      ``,
      `**Old tag**: ${oldTag.trim()}`,
      `**New tag**: ${newTag.trim()}`,
      ``,
      `Please execute the kernel diff analysis workflow:`,
      `1. Clone/update Android Common Kernel repository`,
      `2. Run the analysis script: \`python3 /workspace/custom/skill_examples/kernel_diff_analysis.py ${oldTag.trim()} ${newTag.trim()}\``,
      `3. Analyze each commit's impact on KO modules`,
      `4. Generate the Markdown analysis report`,
    ].join("\n");

    onSubmit(message);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3 mx-2 mb-2 rounded-xl border border-[#F97316]/30 bg-[#161b22]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
          </svg>
          <span className="text-sm font-semibold text-[#F97316]">
            Android Kernel Diff Analysis
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-[#333] transition"
        >
          &times;
        </button>
      </div>

      {/* Tag inputs */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={oldTag}
          onChange={(e) => setOldTag(e.target.value)}
          placeholder="Old tag: android-6.12-2025-08"
          className="flex-1 px-2 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white placeholder-[#525568] focus:border-[#F97316] focus:outline-none"
        />
        <span className="text-[#30363d] text-xs">→</span>
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="New tag: android-6.12-2025-12"
          className="flex-1 px-2 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white placeholder-[#525568] focus:border-[#F97316] focus:outline-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={!oldTag.trim() || !newTag.trim() || disabled}
          className={cn(
            "px-4 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-all",
            oldTag.trim() && newTag.trim() && !disabled
              ? "bg-[#F97316] text-black hover:bg-[#EA690E] cursor-pointer"
              : "bg-[#21262d] text-[#525568] cursor-not-allowed",
          )}
          onClick={handleSubmit}
        >
          Analyze
        </button>
      </div>
    </div>
  );
}
