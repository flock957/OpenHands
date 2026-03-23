#!/usr/bin/env python3
"""Analyze main thread big core running ratio."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze big core ratio")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    # Identify big cores by max frequency
    sql_cores = """
    SELECT cpu, MAX(value) AS max_freq_khz
    FROM counter
    JOIN cpu_counter_track ON counter.track_id = cpu_counter_track.id
    WHERE cpu_counter_track.name = 'cpufreq'
    GROUP BY cpu
    ORDER BY max_freq_khz DESC
    """
    cores = parse_columns(query_tp(args.port, sql_cores))

    if cores:
        max_freq = max(c.get("max_freq_khz", 0) for c in cores)
        big_core_ids = [c["cpu"] for c in cores if c.get("max_freq_khz", 0) >= max_freq * 0.7]
    else:
        big_core_ids = []

    # Per-CPU running time for main thread
    sql = f"""
    SELECT
      ts.cpu,
      SUM(MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})) AS running_ns
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND t.is_main_thread = 1
      AND ts.state = 'Running'
      AND ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
    GROUP BY ts.cpu
    ORDER BY ts.cpu
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_running = sum(r.get("running_ns", 0) for r in rows)
    big_core_running = sum(r.get("running_ns", 0) for r in rows if r.get("cpu") in big_core_ids)
    ratio = (big_core_running / total_running * 100) if total_running > 0 else 0

    severity = "excellent" if ratio > 80 else "good" if ratio > 60 else "fair" if ratio > 40 else "poor"

    output = {
        "big_core_ids": big_core_ids,
        "core_frequencies": cores,
        "per_cpu_running": rows,
        "total_running_ns": total_running,
        "total_running_ms": round(total_running / 1e6, 2),
        "big_core_running_ns": big_core_running,
        "big_core_running_ms": round(big_core_running / 1e6, 2),
        "big_core_ratio_pct": round(ratio, 2),
        "severity": severity,
        "has_issue": severity in ("fair", "poor"),
    }

    save_result(output, "big_core_ratio.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
