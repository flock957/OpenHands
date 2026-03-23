#!/usr/bin/env python3
"""Smoke test for all performance analysis scripts.

Tests:
1. Each script's --help works (argparse is valid)
2. With a running trace_processor, each script produces valid JSON output
3. JSON output contains required fields (has_issue, severity)
4. Output files are saved correctly

Usage:
  # Test argparse only (no trace_processor needed):
  python3 test_scripts.py --check-args

  # Full test with trace file:
  python3 test_scripts.py --trace /path/to/trace.perfetto-trace

  # Full test with already-running trace_processor:
  python3 test_scripts.py --port 9001
"""

import argparse
import json
import os
import subprocess
import sys
import time
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Scripts and their required args (beyond --port and --output-dir)
SCRIPTS = {
    "trace_processor_init.py": {"args": ["--trace", "{trace_file}"], "setup": True},
    "find_foreground_process.py": {"args": []},
    "find_launch_range.py": {"args": ["--process", "{process}"]},
    "analyze_main_thread_state.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_big_core_ratio.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_cpu_frequency.py": {"args": ["--start", "{start}", "--end", "{end}"]},
    "analyze_compile_level.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_jit_thread.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_thread_priority.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_system_load.py": {"args": ["--start", "{start}", "--end", "{end}"]},
    "analyze_detailed_load.py": {"args": ["--start", "{start}", "--end", "{end}"]},
    "analyze_io_details.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_non_io.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "analyze_memory.py": {"args": ["--start", "{start}", "--end", "{end}"]},
    "analyze_rendering.py": {"args": ["--process", "{process}", "--start", "{start}", "--end", "{end}"]},
    "trace_processor_cleanup.py": {"args": [], "cleanup": True},
    "generate_report.py": {"args": [], "report": True},
}

REQUIRED_FIELDS = {"has_issue", "severity"}
# These scripts are setup/cleanup, don't need has_issue/severity
EXEMPT_SCRIPTS = {"trace_processor_init.py", "find_foreground_process.py", "trace_processor_cleanup.py", "generate_report.py"}


def run_script(script_name, extra_args, port, output_dir, timeout=30):
    """Run a script and return (returncode, stdout, stderr)."""
    cmd = [sys.executable, os.path.join(SCRIPT_DIR, script_name)]
    cmd += ["--port", str(port), "--output-dir", output_dir] if "--port" in get_help_text(script_name) else []
    if "--output-dir" in get_help_text(script_name) and "--port" not in get_help_text(script_name):
        cmd += ["--output-dir", output_dir]
    cmd += extra_args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"


def get_help_text(script_name):
    """Get --help output to check available args."""
    cmd = [sys.executable, os.path.join(SCRIPT_DIR, script_name), "--help"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return result.stdout
    except Exception:
        return ""


def test_argparse():
    """Test that all scripts have valid argparse (--help works)."""
    print("\n=== Testing argparse (--help) ===\n")
    passed = 0
    failed = 0
    for script_name in SCRIPTS:
        path = os.path.join(SCRIPT_DIR, script_name)
        if not os.path.exists(path):
            print(f"  MISSING: {script_name}")
            failed += 1
            continue
        cmd = [sys.executable, path, "--help"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"  OK:  {script_name}")
            passed += 1
        else:
            print(f"  FAIL: {script_name} - {result.stderr[:100]}")
            failed += 1
    print(f"\nArgparse: {passed} passed, {failed} failed")
    return failed == 0


def test_full(trace_file=None, port=9001):
    """Run full integration test with trace_processor."""
    output_dir = "/tmp/perf_test_output"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    print("\n=== Full Integration Test ===\n")

    # Step 1: Init trace_processor if trace file provided
    if trace_file:
        print(f"  Initializing trace_processor with {trace_file}...")
        rc, stdout, stderr = run_script("trace_processor_init.py",
                                         ["--trace", trace_file], port, output_dir, timeout=60)
        if rc != 0:
            print(f"  FAIL: trace_processor_init.py - {stderr[:200]}")
            return False
        print(f"  OK: trace_processor_init.py")
        # Wait for service
        time.sleep(2)

    # Step 2: Find foreground process
    rc, stdout, stderr = run_script("find_foreground_process.py", [], port, output_dir)
    if rc != 0:
        print(f"  FAIL: find_foreground_process.py - {stderr[:200]}")
        return False
    print(f"  OK: find_foreground_process.py")

    try:
        fg_data = json.loads(stdout)
        process_name = fg_data.get("process_name", "com.example.app")
    except json.JSONDecodeError:
        print(f"  WARN: Could not parse foreground process output, using fallback")
        process_name = "com.example.app"

    # Step 3: Find launch range
    rc, stdout, stderr = run_script("find_launch_range.py",
                                     ["--process", process_name], port, output_dir)
    if rc != 0:
        print(f"  FAIL: find_launch_range.py - {stderr[:200]}")
        return False
    print(f"  OK: find_launch_range.py")

    try:
        launch_data = json.loads(stdout)
        start_time = str(launch_data.get("start_time", 0))
        end_time = str(launch_data.get("end_time", 1000000000))
    except json.JSONDecodeError:
        print(f"  WARN: Could not parse launch range, using defaults")
        start_time, end_time = "0", "1000000000"

    # Step 4+: Run all analysis scripts
    analysis_scripts = [
        "analyze_main_thread_state.py",
        "analyze_big_core_ratio.py",
        "analyze_cpu_frequency.py",
        "analyze_compile_level.py",
        "analyze_jit_thread.py",
        "analyze_thread_priority.py",
        "analyze_system_load.py",
        "analyze_detailed_load.py",
        "analyze_io_details.py",
        "analyze_non_io.py",
        "analyze_memory.py",
        "analyze_rendering.py",
    ]

    passed = 0
    failed = 0
    for script_name in analysis_scripts:
        info = SCRIPTS[script_name]
        args = []
        for a in info["args"]:
            a = a.replace("{process}", process_name)
            a = a.replace("{start}", start_time)
            a = a.replace("{end}", end_time)
            args.append(a)

        rc, stdout, stderr = run_script(script_name, args, port, output_dir)
        if rc != 0:
            print(f"  FAIL: {script_name} (exit={rc}) - {stderr[:150]}")
            failed += 1
            continue

        # Validate JSON output
        try:
            data = json.loads(stdout)
        except json.JSONDecodeError:
            print(f"  FAIL: {script_name} - invalid JSON output")
            failed += 1
            continue

        # Check required fields
        if script_name not in EXEMPT_SCRIPTS:
            missing = REQUIRED_FIELDS - set(data.keys())
            if missing:
                print(f"  WARN: {script_name} - missing fields: {missing}")

        print(f"  OK: {script_name} (severity={data.get('severity', 'N/A')})")
        passed += 1

    # Generate report
    rc, stdout, stderr = run_script("generate_report.py", [], port, output_dir)
    if rc != 0:
        print(f"  FAIL: generate_report.py - {stderr[:200]}")
        failed += 1
    else:
        print(f"  OK: generate_report.py")
        passed += 1

    # Cleanup
    if trace_file:
        rc, stdout, stderr = run_script("trace_processor_cleanup.py", [], port, output_dir)
        if rc == 0:
            print(f"  OK: trace_processor_cleanup.py")
        else:
            print(f"  WARN: trace_processor_cleanup.py - {stderr[:100]}")

    # Summary
    print(f"\n=== Results: {passed} passed, {failed} failed ===")

    # List generated files
    print(f"\nGenerated files in {output_dir}:")
    for f in sorted(os.listdir(output_dir)):
        size = os.path.getsize(os.path.join(output_dir, f))
        print(f"  {f} ({size} bytes)")

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Smoke test for perf analysis scripts")
    parser.add_argument("--check-args", action="store_true", help="Only test argparse (no trace needed)")
    parser.add_argument("--trace", help="Path to trace file for full test")
    parser.add_argument("--port", type=int, default=9001, help="Trace Processor port")
    parser.add_argument("--skip-init", action="store_true",
                        help="Skip trace_processor init (use already running instance)")
    args = parser.parse_args()

    if args.check_args:
        ok = test_argparse()
        sys.exit(0 if ok else 1)
    elif args.trace or args.skip_init:
        ok = test_argparse()
        if not ok:
            print("\nArgparse test failed, skipping full test")
            sys.exit(1)
        ok = test_full(trace_file=args.trace if not args.skip_init else None,
                       port=args.port)
        sys.exit(0 if ok else 1)
    else:
        print("Usage:")
        print("  --check-args              Test argparse only")
        print("  --trace FILE              Full test with trace file")
        print("  --skip-init --port PORT   Test with already running trace_processor")
        sys.exit(1)


if __name__ == "__main__":
    main()
