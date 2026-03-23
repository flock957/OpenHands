---
name: analyze-memory
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /memory-analysis
- memory analysis
- 内存分析
---

# 内存分析

## 功能
分析系统和进程的内存使用情况，包括 OOM（Out of Memory）、LMK（Low Memory Killer）和 GC（垃圾回收）事件。只输出存在问题的内容。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 本阶段在所有分支分析完成后执行，不依赖分支分析结果。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_memory.py \
  --start <start_time_ns> \
  --end <end_time_ns> \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--start` | 是 | 开始时间（纳秒） |
| `--end` | 是 | 结束时间（纳秒） |
| `--port` | 否 | 默认 9001 |
| `--output-dir` | 否 | 默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `memory_counters`、`oom_lmk_events`、`gc_events`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/memory.json`

## 反思验证
执行完毕后，必须检查：
1. 如果有 OOM/LMK 事件，这是高优先级问题，应在结论中突出
2. GC 事件的频率和耗时是否异常（频繁 GC 可能导致卡顿）
3. 内存计数器的变化趋势是否表明内存泄漏（持续增长）
4. 如果 trace 中没有内存相关数据，应说明"trace 未包含内存计数器"而非"内存正常"
5. severity 判定是否与数据一致

## 下一步
内存分析完成后，执行 `analyze-rendering-depth` 进行渲染分析。
