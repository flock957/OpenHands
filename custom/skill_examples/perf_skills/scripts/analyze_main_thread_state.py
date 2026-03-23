#!/usr/bin/env python3
"""Analyze main thread state distribution."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


THRESHOLDS = {
    "Running": {"normal": (60, 80), "note": "60%-80% is normal"},
    "Runnable": {"warn": 10, "critical": 28, "note": "<10% normal, 10-28% warn, >28% critical"},
    "Sleeping": {"warn": 20, "critical": 40, "note": "<20% normal, 20-40% warn, >40% critical"},
    "IO":       {"warn": 5,  "critical": 10, "note": "<5% normal, 5-10% warn, >10% critical"},
    "Non-IO":   {"warn": 5,  "critical": 10, "note": "<5% normal, 5-10% warn, >10% critical"},
}


def classify(state: str, pct: float) -> str:
    t = THRESHOLDS.get(state, {})
    if state == "Running":
        lo, hi = t.get("normal", (60, 80))
        if pct < lo:
            return "low"
        elif pct > hi:
            return "high"
        return "normal"
    warn = t.get("warn", 999)
    crit = t.get("critical", 999)
    if pct >= crit:
        return "critical"
    elif pct >= warn:
        return "warning"
    return "normal"


def main():
    parser = argparse.ArgumentParser(description="Analyze main thread state")
    add_common_args(parser)
    parser.add_argument("--process", required=True, help="Process name")
    parser.add_argument("--start", required=True, type=int, help="Start time (ns)")
    parser.add_argument("--end", required=True, type=int, help="End time (ns)")
    args = parser.parse_args()

    sql = f"""
    SELECT
      CASE
        WHEN ts.state = 'Running' THEN 'Running'
        WHEN ts.state IN ('R', 'R+') THEN 'Runnable'
        WHEN ts.state = 'S' THEN 'Sleeping'
        WHEN ts.state = 'D' AND ts.io_wait = 1 THEN 'IO'
        WHEN ts.state = 'D' AND (ts.io_wait = 0 OR ts.io_wait IS NULL) THEN 'Non-IO'
        ELSE 'Other'
      END AS state_name,
      COUNT(*) AS count,
      SUM(
        MIN(ts.ts + ts.dur, {args.end}) - MAX(ts.ts, {args.start})
      ) AS total_dur_ns
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND t.is_main_thread = 1
      AND ts.ts + ts.dur > {args.start}
      AND ts.ts < {args.end}
    GROUP BY state_name
    ORDER BY total_dur_ns DESC
    """

    result = query_tp(args.port, sql)
    rows = parse_columns(result)

    total_ns = sum(r.get("total_dur_ns", 0) for r in rows)
    states = []
    issues = []
    for r in rows:
        dur_ns = r.get("total_dur_ns", 0)
        dur_ms = dur_ns / 1e6
        pct = (dur_ns / total_ns * 100) if total_ns > 0 else 0
        name = r["state_name"]
        level = classify(name, pct)
        entry = {
            "state": name,
            "duration_ns": dur_ns,
            "duration_ms": round(dur_ms, 2),
            "percentage": round(pct, 2),
            "count": r.get("count", 0),
            "severity": level,
        }
        states.append(entry)
        if level not in ("normal",):
            issues.append({"state": name, "percentage": round(pct, 2), "severity": level})

    # Determine which branch analyses to trigger
    branches = []
    for s in states:
        name, pct, sev = s["state"], s["percentage"], s["severity"]
        if name == "Running" and sev != "normal":
            branches.append("running")
        elif name == "Runnable" and sev != "normal":
            branches.append("runnable")
        elif name == "Sleeping" and sev != "normal":
            branches.append("sleeping")
        elif name == "IO" and sev != "normal":
            branches.append("io")
        elif name == "Non-IO" and sev != "normal":
            branches.append("non_io")

    # Determine overall severity from worst issue
    worst = "normal"
    for issue in issues:
        sev = issue.get("severity", "normal")
        if sev == "critical":
            worst = "critical"
            break
        elif sev in ("warning", "low", "high") and worst == "normal":
            worst = "warning"

    output = {
        "process": args.process,
        "time_range_ns": args.end - args.start,
        "time_range_ms": round((args.end - args.start) / 1e6, 2),
        "states": states,
        "issues": issues,
        "branches_to_analyze": branches,
        "has_issue": len(issues) > 0,
        "severity": worst,
    }

    save_result(output, "thread_state.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
