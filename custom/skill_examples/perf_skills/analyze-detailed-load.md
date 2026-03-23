---
name: analyze-detailed-load
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /detailed-load
- detailed load
- 详细负载
---

# 详细负载分析

## 功能
分析 Top 进程和线程的详细 CPU 占用情况，识别高负载来源。仅在系统负载 > 80% 时触发。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 仅在 `analyze-system-load` 输出的 `needs_detailed_analysis` 为 true 时才执行此 skill。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_detailed_load.py \
  --start <start_time_ns> \
  --end <end_time_ns> \
  --top-n 15 \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--start` | 是 | 开始时间（纳秒） |
| `--end` | 是 | 结束时间（纳秒） |
| `--top-n` | 否 | 返回前 N 个进程/线程，默认 15 |
| `--port` | 否 | 默认 9001 |
| `--output-dir` | 否 | 默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `top_processes`, `top_threads`, `severity`, `has_issue` 字段
- 文件: `/workspace/perf_analysis_output/detailed_load.json`

## 反思验证
执行完毕后，必须检查：
1. top_processes 中的 running_ms 之和是否与系统总 Running 时间量级一致
2. 排名第一的进程/线程是否是预期中的高负载来源
3. 是否有异常的系统进程占用过多 CPU（如 kworker, logd 等）
4. 检查是否有与目标应用竞争 CPU 的进程

## 下一步
本分支分析完成。根据 `analyze-main-thread-state` 的 `branches_to_analyze`，继续执行其他分支或跳到内存分析。
