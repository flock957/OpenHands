#!/usr/bin/env python3
"""Analyze CPU frequency and thermal throttling."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze CPU frequency")
    add_common_args(parser)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT
      cpu_counter_track.cpu,
      MIN(counter.value) AS min_freq_khz,
      MAX(counter.value) AS max_freq_khz,
      AVG(counter.value) AS avg_freq_khz,
      COUNT(*) AS sample_count
    FROM counter
    JOIN cpu_counter_track ON counter.track_id = cpu_counter_track.id
    WHERE cpu_counter_track.name = 'cpufreq'
      AND counter.ts >= {args.start}
      AND counter.ts <= {args.end}
    GROUP BY cpu_counter_track.cpu
    ORDER BY cpu_counter_track.cpu
    """
    rows = parse_columns(query_tp(args.port, sql))

    # Check thermal throttling
    sql_thermal = f"""
    SELECT ts, value, track.name
    FROM counter
    JOIN track ON counter.track_id = track.id
    WHERE (track.name LIKE '%thermal%' OR track.name LIKE '%throttl%')
      AND counter.ts >= {args.start}
      AND counter.ts <= {args.end}
    ORDER BY ts
    LIMIT 50
    """
    thermal = parse_columns(query_tp(args.port, sql_thermal))

    # Determine severity
    has_throttling = len(thermal) > 0
    min_avg = min((r.get("avg_freq_khz", 0) for r in rows), default=0)
    severity = "normal"
    if has_throttling:
        severity = "critical"
    elif min_avg < 1000000:  # < 1GHz
        severity = "poor"
    elif min_avg < 1500000:  # < 1.5GHz
        severity = "fair"

    output = {
        "per_cpu_frequency": rows,
        "thermal_events": thermal,
        "thermal_event_count": len(thermal),
        "has_throttling": has_throttling,
        "severity": severity,
        "has_issue": severity != "normal",
    }

    save_result(output, "cpu_frequency.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
