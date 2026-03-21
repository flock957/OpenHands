import React from "react";
import { cn } from "#/utils/utils";

interface PerfAnalysisPanelProps {
  onSubmit: (message: string, images: File[], files: File[]) => void;
  disabled?: boolean;
}

const ANALYSIS_DIRECTIONS = [
  { label: "CPU Hotspot Analysis", value: "CPU hotspot analysis - identify most CPU-intensive functions and call paths" },
  { label: "UI Jank / Frame Drops", value: "UI jank and frame drop analysis - detect missed frames and rendering bottlenecks" },
  { label: "Startup Latency", value: "Startup/cold launch latency analysis - break down initialization phases" },
  { label: "Memory Analysis", value: "Memory analysis - allocation patterns, GC pressure, potential leaks" },
  { label: "I/O & Network Latency", value: "I/O and network latency analysis - blocking I/O, binder transactions" },
  { label: "General / Full Analysis", value: "General full performance analysis - comprehensive review of all dimensions" },
];

export function PerfAnalysisPanel({ onSubmit, disabled }: PerfAnalysisPanelProps) {
  const [traceFiles, setTraceFiles] = React.useState<File[]>([]);
  const [selectedDirection, setSelectedDirection] = React.useState(ANALYSIS_DIRECTIONS[5].value);
  const [customDescription, setCustomDescription] = React.useState("");
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTraceFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setTraceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = () => {
    if (traceFiles.length === 0) return;

    setIsAnalyzing(true);

    const direction = customDescription
      ? `${selectedDirection}. Additional requirements: ${customDescription}`
      : selectedDirection;

    const fileNames = traceFiles.map((f) => f.name).join(", ");

    const message = [
      `/perf_analyze`,
      ``,
      `**Trace Files**: ${fileNames}`,
      `**Analysis Direction**: ${direction}`,
      ``,
      `Please analyze the uploaded trace file(s) following the perf_analysis_workflow:`,
      `1. Parse the trace file to extract structured data`,
      `2. Perform performance analysis based on the specified direction`,
      `3. Generate a detailed performance report with findings and recommendations`,
    ].join("\n");

    onSubmit(message, [], traceFiles);
    setIsAnalyzing(false);
  };

  return (
    <div className="flex flex-col gap-4 p-5 mx-4 rounded-xl border border-[#525568] bg-[#1E1F24]">
      <div className="flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4ECDC4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <h3 className="text-base font-bold text-white">Performance Trace Analysis</h3>
      </div>

      {/* File Upload Area */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#A3A3A3]">
          Trace File (Perfetto / systrace / ftrace / Chrome JSON)
        </label>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            traceFiles.length > 0
              ? "border-[#4ECDC4] bg-[#4ECDC4]/5"
              : "border-[#525568] hover:border-[#727987] bg-[#26282D]",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files) {
              setTraceFiles(Array.from(e.dataTransfer.files));
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".perfetto-trace,.pb,.html,.txt,.json,.systrace,.ftrace"
            multiple
            onChange={handleFileChange}
          />
          {traceFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#727987"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm text-[#727987]">
                Click or drag trace file here
              </span>
              <span className="text-xs text-[#525568]">
                Supports: .perfetto-trace, .pb, .html, .txt, .json
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {traceFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#26282D]"
                >
                  <span className="text-sm text-white truncate">
                    {file.name}
                    <span className="text-xs text-[#727987] ml-2">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-[#727987] hover:text-white ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(idx);
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Direction */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#A3A3A3]">
          Analysis Direction
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ANALYSIS_DIRECTIONS.map((dir) => (
            <button
              key={dir.label}
              type="button"
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                selectedDirection === dir.value
                  ? "bg-[#4ECDC4]/20 text-[#4ECDC4] border border-[#4ECDC4]"
                  : "bg-[#26282D] text-[#A3A3A3] border border-[#525568] hover:border-[#727987]",
              )}
              onClick={() => setSelectedDirection(dir.value)}
            >
              {dir.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Description */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#A3A3A3]">
          Additional Description (Optional)
        </label>
        <textarea
          className="w-full px-3 py-2 rounded-lg bg-[#26282D] border border-[#525568] text-sm text-white placeholder-[#525568] focus:border-[#4ECDC4] focus:outline-none resize-none"
          rows={3}
          placeholder="e.g., Focus on the scroll performance during the list view, check if there's main thread blocking during RecyclerView rendering..."
          value={customDescription}
          onChange={(e) => setCustomDescription(e.target.value)}
        />
      </div>

      {/* Analyze Button */}
      <button
        type="button"
        disabled={traceFiles.length === 0 || disabled || isAnalyzing}
        className={cn(
          "w-full py-3 rounded-lg font-semibold text-sm transition-all",
          traceFiles.length > 0 && !disabled && !isAnalyzing
            ? "bg-[#4ECDC4] text-black hover:bg-[#45B7B0] cursor-pointer"
            : "bg-[#525568] text-[#727987] cursor-not-allowed",
        )}
        onClick={handleAnalyze}
      >
        {isAnalyzing ? "Analyzing..." : "One-Click Analysis"}
      </button>
    </div>
  );
}
