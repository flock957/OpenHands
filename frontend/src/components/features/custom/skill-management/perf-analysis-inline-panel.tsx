import React from "react";
import { cn } from "#/utils/utils";

interface PerfAnalysisInlinePanelProps {
  onSubmit: (traceContent: string, message: string) => void;
  onDismiss: () => void;
  disabled?: boolean;
}

const ANALYSIS_DIRECTIONS = [
  { label: "Full", value: "full", desc: "9-phase workflow" },
  { label: "Startup", value: "startup", desc: "Launch perf" },
  { label: "CPU", value: "cpu", desc: "Running/big core/freq" },
  { label: "Scheduling", value: "scheduling", desc: "Runnable/priority" },
  { label: "IO", value: "io", desc: "IO/Non-IO blocking" },
  { label: "Memory", value: "memory", desc: "OOM/GC/alloc" },
  { label: "Rendering", value: "rendering", desc: "Jank/VSYNC" },
];

export function PerfAnalysisInlinePanel({ onSubmit, onDismiss, disabled }: PerfAnalysisInlinePanelProps) {
  const [traceFilePath, setTraceFilePath] = React.useState("");
  const [selectedDirection, setSelectedDirection] = React.useState("full");
  const [customDesc, setCustomDesc] = React.useState("");
  const [traceFile, setTraceFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    const direction = customDesc ? `${dirLabel}: ${customDesc}` : dirLabel;

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

    onSubmit(traceFilePath, message);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3 mx-2 mb-2 rounded-xl border border-[#4ECDC4]/30 bg-[#161b22]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="text-sm font-semibold text-[#4ECDC4]">Performance Trace Analysis</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-[#333] transition"
        >
          &times;
        </button>
      </div>

      {/* Trace file input */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors",
            traceFile
              ? "border-[#4ECDC4]/50 bg-[#4ECDC4]/5"
              : "border-[#30363d] bg-[#0d1117] hover:border-[#525568]",
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={traceFile ? "#4ECDC4" : "#525568"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {traceFile ? (
            <span className="text-xs text-white truncate">
              {traceFile.name}
              <span className="text-[#727987] ml-1">({(traceFile.size / 1024 / 1024).toFixed(1)}MB)</span>
            </span>
          ) : (
            <span className="text-xs text-[#525568]">Upload trace file</span>
          )}
        </div>
        <span className="text-[10px] text-[#30363d]">or</span>
        <input
          type="text"
          value={traceFilePath}
          onChange={(e) => { setTraceFilePath(e.target.value); setTraceFile(null); }}
          placeholder="/workspace/trace.perfetto-trace"
          className="flex-1 px-2 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white placeholder-[#525568] focus:border-[#4ECDC4] focus:outline-none"
        />
      </div>

      {/* Analysis direction chips */}
      <div className="flex flex-wrap gap-1.5">
        {ANALYSIS_DIRECTIONS.map((dir) => (
          <button
            key={dir.value}
            type="button"
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
              selectedDirection === dir.value
                ? "bg-[#4ECDC4]/20 text-[#4ECDC4] border border-[#4ECDC4]/50"
                : "bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:border-[#525568] hover:text-white",
            )}
            onClick={() => setSelectedDirection(dir.value)}
            title={dir.desc}
          >
            {dir.label}
          </button>
        ))}
      </div>

      {/* Custom description + submit */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customDesc}
          onChange={(e) => setCustomDesc(e.target.value)}
          placeholder="Additional focus (optional)..."
          className="flex-1 px-2 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white placeholder-[#525568] focus:border-[#4ECDC4] focus:outline-none"
        />
        <button
          type="button"
          disabled={!traceFilePath.trim() || disabled}
          className={cn(
            "px-4 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-all",
            traceFilePath.trim() && !disabled
              ? "bg-[#4ECDC4] text-black hover:bg-[#45B7B0] cursor-pointer"
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
