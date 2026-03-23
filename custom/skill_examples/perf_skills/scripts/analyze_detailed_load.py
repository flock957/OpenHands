#!/usr/bin/env python3
"""Analyze detailed load - top processes and threads by CPU usage."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze detailed load")
    add_common_args(parser)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    parser.add_argument("--top-n", type=int, default=15)
    args = parser.parse_args()

    # Top processes
    sql_proc = f"""
    SELECT
      p.name AS process_name,
      p.pid,
      SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS running_ns,
      CAST(SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS REAL) / 1e6 AS running_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
      AND p.name IS NOT NULL
    GROUP BY p.upid
    ORDER BY running_ns DESC
    LIMIT {args.top_n}
    """
    procs = parse_columns(query_tp(args.port, sql_proc))

    # Top threads
    sql_thread = f"""
    SELECT
      p.name AS process_name,
      t.name AS thread_name,
      t.tid,
      SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS running_ns,
      CAST(SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS REAL) / 1e6 AS running_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
    GROUP BY ts.utid
    ORDER BY running_ns DESC
    LIMIT {args.top_n}
    """
    threads = parse_columns(query_tp(args.port, sql_thread))

    output = {
        "top_processes": procs,
        "top_threads": threads,
        "has_issue": True,
        "severity": "warning",
    }

    save_result(output, "detailed_load.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
