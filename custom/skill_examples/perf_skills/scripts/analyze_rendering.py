#!/usr/bin/env python3
"""Analyze rendering: frame timing, RenderThread, SurfaceFlinger, VSYNC."""

import argparse
import json
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args


def main():
    parser = argparse.ArgumentParser(description="Analyze rendering")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    parser.add_argument("--target-fps", type=int, default=60)
    args = parser.parse_args()

    frame_budget_ms = 1000.0 / args.target_fps

    # Frame timing (Choreographer doFrame / DrawFrame)
    sql_frames = f"""
    SELECT
      s.dur AS dur_ns,
      CAST(s.dur AS REAL) / 1e6 AS dur_ms
    FROM slice s
    JOIN track t ON s.track_id = t.id
    WHERE (s.name LIKE '%doFrame%' OR s.name LIKE '%DrawFrame%' OR s.name LIKE '%Choreographer%')
      AND s.ts >= {args.start}
      AND s.ts <= {args.end}
    ORDER BY s.ts
    """
    frames = parse_columns(query_tp(args.port, sql_frames))

    frame_times = [f.get("dur_ms", 0) for f in frames]
    total_frames = len(frame_times)
    jank_frames = [t for t in frame_times if t > frame_budget_ms]
    jank_rate = (len(jank_frames) / total_frames * 100) if total_frames > 0 else 0

    sorted_times = sorted(frame_times)
    p50 = sorted_times[len(sorted_times) // 2] if sorted_times else 0
    p90 = sorted_times[int(len(sorted_times) * 0.9)] if sorted_times else 0
    p99 = sorted_times[int(len(sorted_times) * 0.99)] if sorted_times else 0

    # RenderThread state
    sql_render = f"""
    SELECT
      t.name AS thread_name,
      SUM(CASE WHEN ts.state = 'Running' THEN ts.dur ELSE 0 END) AS running_ns,
      SUM(CASE WHEN ts.state IN ('R', 'R+') THEN ts.dur ELSE 0 END) AS runnable_ns,
      SUM(CASE WHEN ts.state = 'S' THEN ts.dur ELSE 0 END) AS sleeping_ns,
      CAST(SUM(CASE WHEN ts.state = 'Running' THEN ts.dur ELSE 0 END) AS REAL) / 1e6 AS running_ms
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN process p ON t.upid = p.upid
    WHERE p.name = '{args.process}'
      AND (t.name = 'RenderThread' OR t.name LIKE '%GPU%')
      AND ts.ts >= {args.start}
      AND ts.ts <= {args.end}
    GROUP BY t.name
    """
    render_stats = parse_columns(query_tp(args.port, sql_render))

    # SurfaceFlinger / VSYNC
    sql_sf = f"""
    SELECT
      s.name,
      COUNT(*) AS count,
      CAST(AVG(s.dur) AS REAL) / 1e6 AS avg_dur_ms,
      CAST(MAX(s.dur) AS REAL) / 1e6 AS max_dur_ms
    FROM slice s
    JOIN track t ON s.track_id = t.id
    WHERE (t.name LIKE '%SurfaceFlinger%' OR s.name LIKE '%VSYNC%' OR s.name LIKE '%vsync%'
           OR s.name LIKE '%onMessageReceived%')
      AND s.ts >= {args.start}
      AND s.ts <= {args.end}
    GROUP BY s.name
    ORDER BY count DESC
    LIMIT 15
    """
    sf_stats = parse_columns(query_tp(args.port, sql_sf))

    severity = "critical" if jank_rate > 20 else "warning" if jank_rate > 5 else "normal"

    output = {
        "target_fps": args.target_fps,
        "frame_budget_ms": frame_budget_ms,
        "total_frames": total_frames,
        "jank_frames": len(jank_frames),
        "jank_rate_pct": round(jank_rate, 2),
        "frame_time_p50_ms": round(p50, 2),
        "frame_time_p90_ms": round(p90, 2),
        "frame_time_p99_ms": round(p99, 2),
        "worst_frame_ms": round(max(frame_times) if frame_times else 0, 2),
        "render_thread_stats": render_stats,
        "surfaceflinger_vsync": sf_stats,
        "severity": severity,
        "has_issue": severity != "normal",
    }

    save_result(output, "rendering.json", args.output_dir)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
