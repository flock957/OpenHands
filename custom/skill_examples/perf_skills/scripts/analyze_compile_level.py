#!/usr/bin/env python3
"""Analyze compile optimization level (JIT/AOT/Interpreted)."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze compile level")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT
      s.name,
      COUNT(*) AS count,
      SUM(s.dur) AS total_dur_ns,
      CAST(SUM(s.dur) AS REAL) / 1e6 AS total_dur_ms
    FROM slice s
    JOIN track t ON s.track_id = t.id
    WHERE (s.name LIKE '%JIT%' OR s.name LIKE '%Compile%' OR s.name LIKE '%compile%'
           OR s.name LIKE '%interpreter%' OR s.name LIKE '%AOT%' OR s.name LIKE '%dex2oat%'
           OR s.name LIKE '%VerifyClass%')
      AND s.ts >= {args.start}
      AND s.ts <= {args.end}
    GROUP BY s.name
    ORDER BY total_dur_ns DESC
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_compile_ms = sum(r.get("total_dur_ms", 0) for r in rows)
    has_issue = total_compile_ms > 100  # >100ms compile time is notable

    output = {
        "compile_activities": rows,
        "total_compile_ms": round(total_compile_ms, 2),
        "has_issue": has_issue,
        "severity": "warning" if has_issue else "normal",
    }

    save_result(output, "compile_level.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
