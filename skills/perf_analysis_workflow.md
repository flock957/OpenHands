---
name: perf_analysis_workflow
triggers:
- /perf_analyze
inputs:
- name: trace_file_path
  description: Path to the trace file to analyze (uploaded to workspace)
- name: analysis_direction
  description: What to focus on - e.g. CPU hotspot, jank/frame drops, startup latency, memory, I/O
---

# Performance Analysis Workflow

You are orchestrating a complete performance analysis pipeline. Follow these steps precisely.

## Workflow Steps

### Step 1: Validate Input
```bash
# Verify trace file exists
if [ ! -f "${trace_file_path}" ]; then
  echo "ERROR: Trace file not found: ${trace_file_path}"
  echo "Please upload the trace file first."
  exit 1
fi

# Get file info
FILE_SIZE=$(du -h "${trace_file_path}" | cut -f1)
FILE_TYPE=$(file "${trace_file_path}")
echo "Trace file: ${trace_file_path}"
echo "Size: ${FILE_SIZE}"
echo "Type: ${FILE_TYPE}"
echo "Analysis direction: ${analysis_direction}"
```

### Step 2: Parse Trace File
Use the **trace_parser** skill to parse the trace file:

1. Detect the trace format (Perfetto/systrace/ftrace/Chrome JSON)
2. Extract structured data: processes, threads, slices, counters
3. Save parsed summary to `/workspace/trace_parsed_summary.json`

```bash
# Create output directory
mkdir -p /workspace/perf_analysis_output

# Parse trace and save summary
python3 << 'PARSE_SCRIPT'
import json
import os
import sys

trace_path = "${trace_file_path}"
output_path = "/workspace/perf_analysis_output/trace_parsed_summary.json"

# Detect format by reading first bytes
with open(trace_path, 'rb') as f:
    header = f.read(20)

trace_format = "unknown"
if header[:4] == b'\x0a':
    trace_format = "perfetto_proto"
elif header[:1] == b'{' or header[:1] == b'[':
    trace_format = "chrome_json"
elif b'<!DOCTYPE' in header or b'<html' in header:
    trace_format = "systrace_html"
elif b'#' in header[:5]:
    trace_format = "ftrace_text"

file_size_mb = os.path.getsize(trace_path) / (1024 * 1024)

summary = {
    "trace_info": {
        "format": trace_format,
        "file_path": trace_path,
        "file_size_mb": round(file_size_mb, 2)
    },
    "processes": [],
    "top_functions": [],
    "warnings": []
}

# Format-specific parsing
if trace_format == "chrome_json":
    with open(trace_path) as f:
        data = json.load(f)
    events = data.get('traceEvents', data) if isinstance(data, dict) else data

    # Extract processes
    procs = {}
    slices = {}
    for e in events:
        pid = e.get('pid', 0)
        name = e.get('name', '')
        if e.get('ph') == 'M' and e.get('name') == 'process_name':
            procs[pid] = e.get('args', {}).get('name', f'pid-{pid}')
        if e.get('ph') in ('X', 'B', 'E') and e.get('dur'):
            key = f"{e.get('cat','')}/{name}"
            if key not in slices:
                slices[key] = {"name": name, "category": e.get('cat',''), "total_dur_us": 0, "count": 0}
            slices[key]["total_dur_us"] += e.get('dur', 0)
            slices[key]["count"] += 1

    # Build process list
    for pid, pname in procs.items():
        summary["processes"].append({"pid": pid, "name": pname})

    # Build top functions
    for key, s in sorted(slices.items(), key=lambda x: -x[1]["total_dur_us"])[:30]:
        summary["top_functions"].append({
            "name": s["name"],
            "category": s["category"],
            "total_dur_ms": round(s["total_dur_us"] / 1000, 2),
            "count": s["count"],
            "avg_dur_ms": round(s["total_dur_us"] / 1000 / max(s["count"],1), 2)
        })

    # Calculate duration
    timestamps = [e.get('ts', 0) for e in events if e.get('ts')]
    if timestamps:
        summary["trace_info"]["duration_ms"] = round((max(timestamps) - min(timestamps)) / 1000, 2)
        summary["trace_info"]["start_timestamp_us"] = min(timestamps)
        summary["trace_info"]["end_timestamp_us"] = max(timestamps)

elif trace_format == "perfetto_proto":
    summary["warnings"].append("Binary Perfetto trace detected. Using trace_processor_shell if available.")

with open(output_path, 'w') as f:
    json.dump(summary, f, indent=2)

print(f"Parsed summary saved to {output_path}")
print(f"Format: {trace_format}")
print(f"Processes: {len(summary['processes'])}")
print(f"Top functions: {len(summary['top_functions'])}")
PARSE_SCRIPT
```

### Step 3: Perform Analysis
Use the **perf_analyzer** skill to analyze parsed data based on `${analysis_direction}`:

1. Load `/workspace/perf_analysis_output/trace_parsed_summary.json`
2. Apply analysis strategy based on the user's direction
3. Generate findings with severity, evidence, and recommendations

```bash
python3 << 'ANALYZE_SCRIPT'
import json
import datetime

# Load parsed data
with open("/workspace/perf_analysis_output/trace_parsed_summary.json") as f:
    summary = json.load(f)

analysis_direction = "${analysis_direction}"
trace_info = summary["trace_info"]
top_functions = summary["top_functions"]

findings = []
total_dur_ms = trace_info.get("duration_ms", 0)

# CPU Hotspot Analysis
if any(kw in analysis_direction.lower() for kw in ["cpu", "hotspot", "all", "general", ""]):
    if top_functions:
        top = top_functions[0]
        pct = round(top["total_dur_ms"] / max(total_dur_ms, 1) * 100, 1) if total_dur_ms else 0
        severity = "Critical" if pct > 30 else "Warning" if pct > 10 else "Info"
        findings.append({
            "title": f"CPU Hotspot: {top['name']}",
            "severity": severity,
            "impact": f"Consumes {top['total_dur_ms']}ms ({pct}% of trace duration)",
            "evidence": f"Called {top['count']} times, avg {top['avg_dur_ms']}ms per call",
            "recommendation": f"Profile {top['name']} in detail; consider caching or algorithmic optimization"
        })

# High call count detection
for func in top_functions:
    if func["count"] > 100 and func["avg_dur_ms"] < 1:
        findings.append({
            "title": f"Tight Loop: {func['name']}",
            "severity": "Warning",
            "impact": f"Called {func['count']} times in {total_dur_ms}ms",
            "evidence": f"Avg {func['avg_dur_ms']}ms per call, total {func['total_dur_ms']}ms",
            "recommendation": "Consider batching or reducing call frequency"
        })

# Generate report
report = f"""# Performance Analysis Report

## Summary
- **Trace file**: {trace_info['file_path']}
- **Format**: {trace_info['format']}
- **File size**: {trace_info['file_size_mb']}MB
- **Duration**: {total_dur_ms}ms
- **Analysis focus**: {analysis_direction}
- **Analysis time**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **Overall verdict**: {"CRITICAL" if any(f["severity"]=="Critical" for f in findings) else "NEEDS_ATTENTION" if findings else "GOOD"}

## Key Findings

"""

for i, f in enumerate(findings, 1):
    report += f"""### Finding {i}: {f['title']}
- **Severity**: {f['severity']}
- **Impact**: {f['impact']}
- **Evidence**: {f['evidence']}
- **Recommendation**: {f['recommendation']}

"""

# Top functions table
report += """## Top Functions by Duration

| Rank | Function | Category | Total (ms) | Count | Avg (ms) |
|------|----------|----------|-----------|-------|----------|
"""
for i, func in enumerate(top_functions[:15], 1):
    report += f"| {i} | {func['name']} | {func['category']} | {func['total_dur_ms']} | {func['count']} | {func['avg_dur_ms']} |\n"

report += """
## Recommendations

"""
for i, f in enumerate(findings, 1):
    priority = "High" if f["severity"] == "Critical" else "Medium" if f["severity"] == "Warning" else "Low"
    report += f"{i}. **[Priority: {priority}]** {f['recommendation']}\n"

# Save report
report_path = "/workspace/perf_analysis_output/performance_report.md"
with open(report_path, 'w') as f:
    f.write(report)

print(f"Report saved to: {report_path}")
print("=" * 60)
print(report)
ANALYZE_SCRIPT
```

### Step 4: Present Results

After analysis completes:
1. Display the full report content to the user
2. Highlight the most critical findings
3. Ask if the user wants deeper analysis on specific findings
4. Offer to export in different formats (HTML, PDF) if needed

```bash
echo "Analysis complete!"
echo "Report location: /workspace/perf_analysis_output/performance_report.md"
echo "Parsed data: /workspace/perf_analysis_output/trace_parsed_summary.json"
cat /workspace/perf_analysis_output/performance_report.md
```

## Error Handling

- If trace file is missing: Prompt user to upload the file
- If format is unrecognized: List supported formats and suggest conversion
- If trace_processor_shell is needed but not available: Fall back to Python parsing
- If trace is too large (>500MB): Use streaming approach, analyze in chunks
