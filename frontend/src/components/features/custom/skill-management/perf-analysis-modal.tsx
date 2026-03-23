import React from "react";
import { cn } from "#/utils/utils";

interface PerfAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (traceContent: string, analysisDirection: string) => void;
  disabled?: boolean;
}

const ANALYSIS_DIRECTIONS = [
  { label: "Full Analysis", value: "full", desc: "Complete 9-phase analysis workflow" },
  { label: "Startup Latency", value: "startup", desc: "Focus on app launch performance" },
  { label: "CPU Hotspot", value: "cpu", desc: "Running state, big core, CPU frequency" },
  { label: "Scheduling", value: "scheduling", desc: "Runnable, thread priority, system load" },
  { label: "IO Bottleneck", value: "io", desc: "IO and Non-IO blocking analysis" },
  { label: "Memory", value: "memory", desc: "Memory usage, OOM, GC pressure" },
  { label: "Rendering / Jank", value: "rendering", desc: "Frame timing, RenderThread, VSYNC" },
];

export function PerfAnalysisModal({ isOpen, onClose, onSubmit, disabled }: PerfAnalysisModalProps) {
  const [traceFilePath, setTraceFilePath] = React.useState("");
  const [selectedDirection, setSelectedDirection] = React.useState("full");
  const [customDesc, setCustomDesc] = React.useState("");
  const [traceFile, setTraceFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTraceFile(file);
      setTraceFilePath(`/workspace/${file.name}`);
    }
  };

  const handleSubmit = () => {
    if (!traceFilePath.trim()) return;

    const dirLabel = ANALYSIS_DIRECTIONS.find(d => d.value === selectedDirection)?.label || selectedDirection;
    const direction = customDesc
      ? `${dirLabel}: ${customDesc}`
      : dirLabel;

    const message = [
      `Execute skill: perf-analysis-workflow (trigger: /perf-analyze). Follow the skill instructions to complete the task.`,
      ``,
      `**Trace file path**: ${traceFilePath}`,
      `**Analysis direction**: ${direction}`,
      ``,
      `Please execute the performance analysis workflow:`,
      `1. Initialize trace_processor with the trace file`,
      `2. Find foreground process`,
      `3. Determine launch time range`,
      `4. Analyze main thread state distribution`,
      `5. Run branch analysis based on state results`,
      `6. Analyze memory`,
      `7. Analyze rendering`,
      `8. Cleanup trace_processor`,
      `9. Generate HTML report (full_report.html + issue_report.html)`,
    ].join("\n");

    onSubmit(traceFile ? traceFilePath : traceFilePath, message);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-h-[80vh] bg-[#1E1F24] border border-[#525568] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <h2 className="text-base font-bold text-white">Performance Trace Analysis</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Trace File */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#A3A3A3]">Trace File</label>

            {/* File upload area */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors",
                traceFile
                  ? "border-[#4ECDC4] bg-[#4ECDC4]/5"
                  : "border-[#525568] hover:border-[#727987] bg-[#26282D]",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".perfetto-trace,.pb,.html,.txt,.json,.systrace,.ftrace,.pftrace"
                onChange={handleFileChange}
              />
              {traceFile ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-white">{traceFile.name}</span>
                  <span className="text-xs text-[#727987]">({(traceFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              ) : (
                <span className="text-sm text-[#727987]">Click to upload trace file</span>
              )}
            </div>

            {/* Or paste path */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#525568]">or paste file path:</span>
              <input
                type="text"
                value={traceFilePath}
                onChange={(e) => setTraceFilePath(e.target.value)}
                placeholder="/workspace/your_trace.perfetto-trace"
                className="flex-1 px-2 py-1.5 bg-[#26282D] border border-[#525568] rounded text-xs text-white focus:border-[#4ECDC4] focus:outline-none"
              />
            </div>
          </div>

          {/* Analysis Direction */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#A3A3A3]">Analysis Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {ANALYSIS_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  type="button"
                  className={cn(
                    "px-3 py-2 rounded-lg text-left transition-colors",
                    selectedDirection === dir.value
                      ? "bg-[#4ECDC4]/20 text-[#4ECDC4] border border-[#4ECDC4]"
                      : "bg-[#26282D] text-[#A3A3A3] border border-[#525568] hover:border-[#727987]",
                  )}
                  onClick={() => setSelectedDirection(dir.value)}
                >
                  <span className="text-xs font-medium block">{dir.label}</span>
                  <span className="text-[10px] text-[#727987] block mt-0.5">{dir.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#A3A3A3]">Additional Description (Optional)</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-[#26282D] border border-[#525568] text-xs text-white placeholder-[#525568] focus:border-[#4ECDC4] focus:outline-none resize-none"
              rows={2}
              placeholder="e.g., Focus on scroll performance during list view rendering..."
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#30363d]">
          <button
            type="button"
            disabled={!traceFilePath.trim() || disabled}
            className={cn(
              "w-full py-2.5 rounded-lg font-semibold text-sm transition-all",
              traceFilePath.trim() && !disabled
                ? "bg-[#4ECDC4] text-black hover:bg-[#45B7B0] cursor-pointer"
                : "bg-[#525568] text-[#727987] cursor-not-allowed",
            )}
            onClick={handleSubmit}
          >
            One-Click Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
