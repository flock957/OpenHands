---
name: analyze-jit-thread
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /jit-thread
- jit thread
- JIT线程
---

# JIT 线程分析

## 功能
分析 JIT 编译线程的运行时间，判断 JIT 编译是否占用过多 CPU 资源。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_jit_thread.py \
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
- stdout: JSON 格式，包含 `jit_threads`（各 JIT 线程的 running_ms）、`total_jit_ms`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/jit_thread.json`

## 反思验证
执行完毕后，必须检查：
1. 如果没有找到 JIT 线程，可能是进程名不匹配或 trace 中无 JIT 活动——应说明而非报错
2. JIT 线程的 running_ms 是否在合理范围（不应超过总分析时间）
3. severity 判定是否与 JIT 占用时间的比例一致
4. 结合 compile-level 的结果综合判断编译优化状况

## 下一步
Running 分支分析完成。根据 `analyze-main-thread-state` 的 `branches_to_analyze`，继续执行其他分支或跳到内存分析。
