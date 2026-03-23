---
name: analyze-main-thread-priority
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /thread-priority
- thread priority
- 线程优先级
---

# 主线程优先级分析

## 功能
分析主线程的调度优先级和抢占情况，判断是否因优先级问题导致调度延迟（Runnable 时间过长）。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_thread_priority.py \
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
| `--port` | 否 | 默认 9001 |
| `--output-dir` | 否 | 默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `preemption_details`（被抢占的详细记录）、`top_preemptors`（主要抢占来源）、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/thread_priority.json`

## 反思验证
执行完毕后，必须检查：
1. preemption_details 中的 dur_ms 是否合理（通常单次抢占在 1ms - 100ms 范围）
2. waker_process 是否为已知系统进程（如 surfaceflinger, system_server）——这有助于判断抢占原因
3. 如果没有长时间抢占记录，Runnable 偏高可能是系统整体负载导致，而非优先级问题
4. severity 判定是否与抢占数据一致

## 下一步
继续执行 Runnable 分支的下一个分析：`analyze-system-load`。
