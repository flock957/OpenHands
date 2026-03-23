---
name: analyze-main-thread-state
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /analyze-thread-state
- main thread state
- 主线程状态
---

# 主线程状态分析

## 功能
分析指定进程主线程的状态分布（Running/Runnable/Sleeping/IO/Non-IO），识别异常状态，决定后续分支分析路径。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 分支分析路径完全由脚本输出的 `branches_to_analyze` 字段决定，不要自行判断。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_main_thread_state.py \
  --process <process_name> \
  --start <start_time_ns> \
  --end <end_time_ns> \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--process` | 是 | 目标进程名称 |
| `--start` | 是 | 开始时间（纳秒） |
| `--end` | 是 | 结束时间（纳秒） |
| `--port` | 否 | Trace Processor HTTP 端口，默认 9001 |
| `--output-dir` | 否 | 输出目录，默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含：
  - `states`: 各状态的 duration_ms, percentage, severity
  - `issues`: 异常状态列表
  - `branches_to_analyze`: 需要执行的分支分析列表（如 `["running", "runnable"]`）
  - `has_issue`: 是否存在异常
- 文件: `/workspace/perf_analysis_output/thread_state.json`

## 判断标准
| 状态 | 正常 | 偏高/异常 | 严重 |
|------|------|----------|------|
| Running | 60%-80% | <60% 或 >80% | - |
| Runnable | <10% | 10%-28% | >28% |
| Sleeping | <20% | 20%-40% | >40% |
| IO | <5% | 5%-10% | >10% |
| Non-IO | <5% | 5%-10% | >10% |

## 反思验证
执行完毕后，必须检查：
1. 所有状态的 percentage 加起来应接近 100%（允许误差 5% 由 "Other" 状态引起）
2. 每个状态的 severity 是否与上述判断标准表一致
3. `branches_to_analyze` 是否合理 — 只有 severity 不为 "normal" 的状态才应出现
4. 如果所有状态都是 normal，则 `branches_to_analyze` 应为空，可直接跳到内存分析
5. 确认 duration_ms 之和是否接近 `time_range_ms`

## 下一步
根据 `branches_to_analyze` 字段执行对应的分支分析：
- `"running"` → 依次执行: `main-thread-big-core-ratio`, `analyze-cpu-frequency`, `analyze-compile-level`, `analyze-jit-thread`
- `"runnable"` → 依次执行: `analyze-main-thread-priority`, `analyze-system-load`（负载>80%时追加 `analyze-detailed-load`）
- `"sleeping"` → 执行: `analyze-system-load`（负载>80%时追加 `analyze-detailed-load`）
- `"io"` → 执行: `analyze-io-details`
- `"non_io"` → 执行: `analyze-non-io`
