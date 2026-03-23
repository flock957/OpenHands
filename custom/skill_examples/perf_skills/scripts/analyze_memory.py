#!/usr/bin/env python3
"""Analyze memory usage, OOM, LMK, GC events."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze memory")
    add_common_args(parser)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    # Memory counters
    sql_mem = f"""
    SELECT
      track.name,
      MIN(counter.value) AS min_val,
      MAX(counter.value) AS max_val,
      AVG(counter.value) AS avg_val
    FROM counter
    JOIN track ON counter.track_id = track.id
    WHERE (track.name LIKE '%mem%' OR track.name LIKE '%Mem%'
           OR track.name LIKE '%Swap%' OR track.name LIKE '%lmk%'
           OR track.name LIKE '%oom%')
      AND counter.ts >= {args.start}
      AND counter.ts <= {args.end}
    GROUP BY track.name
    ORDER BY track.name
    """
    mem_counters = parse_columns(query_tp(args.port, sql_mem))

    # OOM / LMK / GC events
    sql_events = f"""
    SELECT s.ts, s.name, s.dur,
      CAST(s.dur AS REAL) / 1e6 AS dur_ms
    FROM slice s
    JOIN track t ON s.track_id = t.id
    WHERE (s.name LIKE '%oom%' OR s.name LIKE '%lowmemory%' OR s.name LIKE '%lmk%'
           OR s.name LIKE '%kill%process%' OR s.name LIKE '%GC%'
           OR s.name LIKE '%Heap%' OR s.name LIKE '%alloc%')
      AND s.ts >= {args.start}
      AND s.ts <= {args.end}
    ORDER BY s.dur DESC
    LIMIT 30
    """
    events = parse_columns(query_tp(args.port, sql_events))

    gc_events = [e for e in events if "GC" in e.get("name", "")]
    oom_events = [e for e in events if any(k in e.get("name", "").lower() for k in ["oom", "lmk", "kill"])]

    has_issue = len(oom_events) > 0 or len(gc_events) > 10

    output = {
        "memory_counters": mem_counters,
        "gc_events_count": len(gc_events),
        "oom_lmk_events_count": len(oom_events),
        "notable_events": events[:15],
        "has_issue": has_issue,
        "severity": "critical" if oom_events else "warning" if len(gc_events) > 10 else "normal",
    }

    save_result(output, "memory.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
