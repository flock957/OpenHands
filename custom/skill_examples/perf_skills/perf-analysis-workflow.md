---
name: perf-analysis-workflow
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /perf-analyze
- 性能分析
- performance analysis workflow
---

# 性能分析工作流

## 概述
系统地分析 Perfetto trace 文件的性能问题。严格按以下 9 个阶段顺序执行，每阶段调用对应 Python 脚本。

**核心原则：**
1. **禁止自行编写 SQL 或分析代码** — 必须使用指定脚本
2. **每步执行后必须反思验证** — 检查输出是否合理、是否符合预期
3. **遇到错误立即停止** — 报告错误原因，不要跳过失败的步骤继续执行
4. **参数必须来自上一步的输出** — 不要猜测进程名、时间范围等

所有脚本位于：`/workspace/custom/skill_examples/perf_skills/scripts/`
所有输出保存到：`/workspace/perf_analysis_output/`

---

## 第一阶段：初始化 Trace Processor

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/trace_processor_init.py \
  --trace <用户提供的trace文件路径> --port 9001
```

**验证：** 输出包含 `"status": "ready"`，且 `curl -s http://localhost:9001/status` 可达。
**失败处理：** 如果 trace 文件不存在或服务启动失败，停止并报告错误。

---

## 第二阶段：确定分析目标

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/find_foreground_process.py --port 9001
```

**验证：** 输出包含合理的 `process_name`（Android 包名格式）。
**反思：** 如果使用了 fallback 方法，结果可能不够准确，应在最终报告中注明。
**失败处理：** 如果无法确定进程，询问用户是否手动指定。

**记录：** `PROCESS_NAME` ← 输出中的 `process_name`

---

## 第三阶段：确定时间范围

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/find_launch_range.py \
  --process $PROCESS_NAME --port 9001
```

**验证：** `end_time > start_time`，`duration_ms` 在 200ms - 30000ms 范围内。
**反思：** 如果 duration 异常（< 200ms 或 > 30s），可能检测有误，检查是否使用了 fallback。
**失败处理：** 如果找不到启动时间范围，询问用户是否指定分析的时间区间。

**记录：** `START_TIME` ← `start_time`，`END_TIME` ← `end_time`

---

## 第四阶段：主线程状态分析

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_main_thread_state.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001
```

**验证：**
- 所有状态 percentage 之和接近 100%
- severity 判定与判断标准一致
- `branches_to_analyze` 只包含 severity 不为 normal 的状态

**反思：** 如果所有状态都正常（branches_to_analyze 为空），直接跳到第六阶段（内存分析）。

**记录：** `BRANCHES` ← `branches_to_analyze` 数组

---

## 第五阶段：分支分析（根据第四阶段结果动态选择）

**重要：只执行 `BRANCHES` 中包含的分支，不要执行不在列表中的分支。**

### 5.1 如果 `"running"` 在 BRANCHES 中

依次执行以下 4 个脚本：

```bash
# 5.1.1 大核运行分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_big_core_ratio.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001

# 5.1.2 CPU 频率分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_cpu_frequency.py \
  --start $START_TIME --end $END_TIME --port 9001

# 5.1.3 编译优化级别分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_compile_level.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001

# 5.1.4 JIT 线程分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_jit_thread.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001
```

**反思：** 综合 4 项结果判断 Running 异常的根因：是大核调度不足？CPU 限频？还是编译优化不够？

### 5.2 如果 `"runnable"` 在 BRANCHES 中

```bash
# 5.2.1 线程优先级分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_thread_priority.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001

# 5.2.2 系统负载分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_system_load.py \
  --start $START_TIME --end $END_TIME --port 9001
```

如果 system_load 输出的 `needs_detailed_analysis` 为 true：
```bash
# 5.2.3 详细负载分析（仅在负载 > 80% 时执行）
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_detailed_load.py \
  --start $START_TIME --end $END_TIME --top-n 15 --port 9001
```

**反思：** Runnable 偏高是因为被高优先级进程抢占，还是系统整体负载过高？

### 5.3 如果 `"sleeping"` 在 BRANCHES 中

```bash
# 5.3.1 系统负载分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_system_load.py \
  --start $START_TIME --end $END_TIME --port 9001
```

如果 `needs_detailed_analysis` 为 true：
```bash
# 5.3.2 详细负载分析
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_detailed_load.py \
  --start $START_TIME --end $END_TIME --top-n 15 --port 9001
```

**注意：** 如果 5.2 已执行过 system_load/detailed_load，不要重复执行，直接使用已有结果。

### 5.4 如果 `"io"` 在 BRANCHES 中

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_io_details.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001
```

**反思：** IO 阻塞是否集中在主线程？blocked_function 是否指向可优化的操作？

### 5.5 如果 `"non_io"` 在 BRANCHES 中

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_non_io.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --port 9001
```

**反思：** 是否存在锁竞争热点？阻塞是否集中在特定线程？

---

## 第六阶段：内存分析

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_memory.py \
  --start $START_TIME --end $END_TIME --port 9001
```

**验证：** 输出格式正确，如果有 OOM/LMK 事件，标记为高优先级问题。
**反思：** 内存问题可能是导致其他性能问题的根因（如频繁 GC 导致 Sleeping 偏高）。

---

## 第七阶段：渲染分析

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_rendering.py \
  --process $PROCESS_NAME --start $START_TIME --end $END_TIME --target-fps 60 --port 9001
```

**验证：** 帧数 > 0（否则说明 trace 中没有渲染事件）。
**反思：** jank 率是否与前面分析发现的问题一致？例如 Running 异常可能导致掉帧。

---

## 第八阶段：清理

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/trace_processor_cleanup.py \
  --output-dir /workspace/perf_analysis_output
```

**验证：** `curl -s http://localhost:9001/status` 返回连接失败。

---

## 第九阶段：生成 HTML 报告

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/generate_report.py \
  --output-dir /workspace/perf_analysis_output
```

**验证：** `full_report.html` 和 `issue_report.html` 已生成。

**最终反思（必须执行）：**
1. 回顾所有分析结果，检查结论之间是否矛盾（如系统负载低但 Runnable 很高 — 需要解释原因）
2. 检查是否有遗漏的分支分析
3. 各分析项的 severity 是否合理
4. 报告中的优化建议是否具有可操作性
5. 向用户汇总关键发现：最严重的 N 个问题 + 建议的优化方向

---

## 判断标准速查表

### 主线程状态
| 状态 | 正常 | 偏高 | 严重 |
|------|------|------|------|
| Running | 60%-80% | <60% 或 >80% | - |
| Runnable | <10% | 10%-28% | >28% |
| Sleeping | <20% | 20%-40% | >40% |
| IO | <5% | 5%-10% | >10% |
| Non-IO | <5% | 5%-10% | >10% |

### 启动时间
| 优秀 | 良好 | 一般 | 较差 | 严重 |
|------|------|------|------|------|
| <1000ms | 1000-1500ms | 1500-2000ms | 2000-3000ms | >3000ms |

### 大核运行占比
| 优秀 | 良好 | 一般 | 较差 |
|------|------|------|------|
| >80% | 60-80% | 40-60% | <40% |

### 系统负载
| 正常 | 一般 | 较高 | 严重 |
|------|------|------|------|
| <50% | 50-80% | 80-95% | >95% |

### 优先级排序
- **高（立即处理）：** 启动>2s, Running<60%, Runnable>20%, 大核<40%, 持续限频, IO>10%, Non-IO>10%, 负载>80%
- **中（建议优化）：** 启动1.5-2s, Running 60-70%, Runnable 10-20%, 大核40-60%, IO 5-10%, 负载60-88%
- **低（持续关注）：** 启动1-1.5s, Running 70-80%, 大核60-80%, IO<5%, 负载50-68%
