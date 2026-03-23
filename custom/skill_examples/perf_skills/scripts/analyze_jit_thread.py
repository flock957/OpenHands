#!/usr/bin/env python3
"""Analyze JIT thread running time."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze JIT thread")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT
      t.name AS thread_name,
      SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS running_ns,
      CAST(SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS REAL) / 1e6 AS running_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND (t.name LIKE '%Jit%' OR t.name LIKE '%JIT%' OR t.name LIKE '%compiler%')
      AND ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
    GROUP BY t.name
    ORDER BY running_ns DESC
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_jit_ms = sum(r.get("running_ms", 0) for r in rows)

    output = {
        "jit_threads": rows,
        "total_jit_running_ms": round(total_jit_ms, 2),
        "has_issue": total_jit_ms > 50,
        "severity": "warning" if total_jit_ms > 50 else "normal",
    }

    save_result(output, "jit_thread.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
