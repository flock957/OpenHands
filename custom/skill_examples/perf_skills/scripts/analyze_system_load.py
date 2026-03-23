#!/usr/bin/env python3
"""Analyze system CPU load."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze system load")
    add_common_args(parser)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    duration = args.end - args.start

    sql = f"""
    SELECT
      ts.cpu,
      SUM(CASE WHEN ts.state = 'Running' THEN
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ELSE 0 END) AS running_ns
    FROM thread_state ts
    WHERE ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
      AND ts.cpu IS NOT NULL
    GROUP BY ts.cpu
    ORDER BY ts.cpu
    """
    rows = parse_columns(query_tp(args.port, sql))

    cpu_count = len(rows)
    total_capacity = duration * cpu_count if cpu_count > 0 else 1
    total_running = sum(r.get("running_ns", 0) for r in rows)
    load_pct = (total_running / total_capacity * 100) if total_capacity > 0 else 0

    per_cpu = []
    for r in rows:
        util = (r.get("running_ns", 0) / duration * 100) if duration > 0 else 0
        per_cpu.append({"cpu": r["cpu"], "utilization_pct": round(util, 2)})

    severity = "normal" if load_pct < 50 else "fair" if load_pct < 80 else "high" if load_pct < 95 else "critical"
    needs_detailed = load_pct > 80

    output = {
        "cpu_count": cpu_count,
        "duration_ms": round(duration / 1e6, 2),
        "total_running_ns": total_running,
        "system_load_pct": round(load_pct, 2),
        "per_cpu_utilization": per_cpu,
        "severity": severity,
        "needs_detailed_analysis": needs_detailed,
        "has_issue": severity not in ("normal",),
    }

    save_result(output, "system_load.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
