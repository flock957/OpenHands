#!/usr/bin/env python3
"""Analyze Non-IO blocking (locks, futex, etc)."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze Non-IO blocking")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT
      t.name AS thread_name,
      ts.blocked_function,
      COUNT(*) AS count,
      SUM(ts.dur) AS total_dur_ns,
      CAST(SUM(ts.dur) AS REAL) / 1e6 AS total_dur_ms,
      CAST(MAX(ts.dur) AS REAL) / 1e6 AS max_dur_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND ts.state = 'D'
      AND (ts.io_wait = 0 OR ts.io_wait IS NULL)
      AND ts.ts >= {args.start}
      AND ts.ts <= {args.end}
    GROUP BY t.name, ts.blocked_function
    ORDER BY total_dur_ns DESC
    LIMIT 20
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_ms = sum(r.get("total_dur_ms", 0) for r in rows)

    output = {
        "non_io_blocking_details": rows,
        "total_non_io_blocking_ms": round(total_ms, 2),
        "has_issue": total_ms > 10,
        "severity": "critical" if total_ms > 100 else "warning" if total_ms > 10 else "normal",
    }

    save_result(output, "non_io.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
