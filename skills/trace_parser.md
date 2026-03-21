---
name: trace_parser
type: knowledge
version: 1.0.0
agent: CodeActAgent
triggers:
- trace
- perfetto
- systrace
- ftrace
---

# Trace File Parser Skill

You are an expert at parsing and extracting structured data from performance trace files (Perfetto, systrace, ftrace, etc.).

## Supported Trace Formats

1. **Perfetto Proto Trace** (.perfetto-trace, .pb) — Binary protobuf format from Android/Chrome
2. **Systrace HTML** (.html) — Legacy Android system trace
3. **ftrace text** (.txt) — Raw kernel ftrace output
4. **Chrome JSON Trace** (.json) — Chrome Trace Event Format

## Parsing Workflow

When given a trace file path, follow these steps:

### Step 1: Identify Format
```bash
# Check file type
file "${TRACE_FILE_PATH}"
# Check first bytes for format detection
head -c 100 "${TRACE_FILE_PATH}" | xxd | head -5
```

### Step 2: Extract Data Using trace_processor

For Perfetto traces, use `trace_processor_shell` if available:
```bash
# Check if trace_processor is available
which trace_processor_shell 2>/dev/null || echo "trace_processor_shell not found"

# If available, run SQL queries to extract key metrics
trace_processor_shell "${TRACE_FILE_PATH}" --query "
  SELECT ts, dur, name, category, track_id
  FROM slice
  ORDER BY ts
  LIMIT 1000
"
```

For non-Perfetto formats, parse directly:
```bash
# For Chrome JSON traces
python3 -c "
import json, sys
with open('${TRACE_FILE_PATH}') as f:
    data = json.load(f)
events = data.get('traceEvents', data) if isinstance(data, dict) else data
print(f'Total events: {len(events)}')
# Extract key categories
categories = {}
for e in events:
    cat = e.get('cat', 'unknown')
    categories[cat] = categories.get(cat, 0) + 1
for cat, count in sorted(categories.items(), key=lambda x: -x[1])[:20]:
    print(f'  {cat}: {count}')
"
```

### Step 3: Extract Key Metrics

Always extract these core metrics from the trace:
1. **Trace Duration**: Total time span covered
2. **Process/Thread List**: Active processes and threads
3. **Top Functions by Duration**: Longest-running slices/functions
4. **CPU Scheduling**: CPU usage distribution across cores
5. **I/O Events**: Disk and network activity patterns
6. **Memory Events**: Allocation patterns if available
7. **Frame Rendering** (if UI trace): Frame times, jank detection

### Step 4: Output Structured Data

Output parsed data as a structured JSON summary:
```json
{
  "trace_info": {
    "format": "perfetto|systrace|ftrace|chrome_json",
    "file_path": "/path/to/trace",
    "file_size_mb": 0.0,
    "duration_ms": 0.0,
    "start_timestamp_ns": 0,
    "end_timestamp_ns": 0
  },
  "processes": [
    {"pid": 0, "name": "process_name", "thread_count": 0}
  ],
  "top_functions": [
    {"name": "func_name", "category": "cat", "total_dur_ms": 0.0, "count": 0, "avg_dur_ms": 0.0}
  ],
  "cpu_usage": {
    "core_count": 0,
    "per_core_utilization_pct": [0.0]
  },
  "warnings": ["any parsing warnings"]
}
```

## Important Notes

- Always validate the file exists and is readable before parsing
- For large traces (>100MB), use streaming/chunked processing
- If `trace_processor_shell` is not installed, fall back to Python-based parsing
- Preserve original timestamps in nanoseconds for downstream analysis
- If the trace format is unrecognized, report clearly and suggest conversion tools
