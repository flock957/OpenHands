#!/usr/bin/env python3
"""Analyze main thread priority preemption."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze thread priority")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT
      ts.state,
      ts.cpu,
      ts.dur AS dur_ns,
      CAST(ts.dur AS REAL) / 1e6 AS dur_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND t.is_main_thread = 1
      AND (ts.state = 'R' OR ts.state = 'R+')
      AND ts.ts >= {args.start}
      AND ts.ts <= {args.end}
      AND ts.dur > 1000000
    ORDER BY ts.dur DESC
    LIMIT 20
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_preempt_ms = sum(r.get("dur_ms", 0) for r in rows)
    max_preempt_ms = rows[0].get("dur_ms", 0) if rows else 0

    output = {
        "preemption_events": rows,
        "total_preempt_ms": round(total_preempt_ms, 2),
        "max_single_preempt_ms": round(max_preempt_ms, 2),
        "event_count": len(rows),
        "has_issue": max_preempt_ms > 5,
        "severity": "critical" if max_preempt_ms > 10 else "warning" if max_preempt_ms > 5 else "normal",
    }

    save_result(output, "thread_priority.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
