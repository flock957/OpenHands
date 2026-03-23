---
name: analyze-rendering-depth
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /rendering
- rendering analysis
- 渲染分析
---

# 渲染深度分析

## 功能
分析帧渲染分布、RenderThread/SurfaceFlinger 链路、VSYNC 等待占比，判断是否存在掉帧或渲染瓶颈。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_rendering.py \
  --process <process_name> \
  --start <start_time_ns> \
  --end <end_time_ns> \
  --target-fps 60 \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--process` | 是 | 目标进程名称 |
| `--start` | 是 | 开始时间（纳秒） |
| `--end` | 是 | 结束时间（纳秒） |
| `--target-fps` | 否 | 目标帧率，默认 60（用于 jank 判定） |
| `--port` | 否 | 默认 9001 |
| `--output-dir` | 否 | 默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `frame_stats`（帧数/jank率/P50/P90/P99）、`render_thread`、`sf_vsync`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/rendering.json`

## 帧率判断标准
| 目标帧率 | 帧预算 |
|----------|--------|
| 60fps | 16.67ms |
| 90fps | 11.11ms |
| 120fps | 8.33ms |

Jank 定义：帧时间超过帧预算的帧。

## 反思验证
执行完毕后，必须检查：
1. 帧数是否合理 — 如果帧数为 0，可能是 trace 中没有渲染事件或进程名不匹配
2. jank_rate 是否在 0-100% 范围内
3. P90/P99 帧时间是否远高于帧预算 — 这意味着存在明显的掉帧
4. RenderThread 是否有大量 Runnable/Sleeping 时间 — 这可能是渲染延迟的原因
5. severity 判定是否与 jank 率一致

## 下一步
渲染分析完成后，执行 `trace-processor-cleanup` 清理 Trace Processor 服务。
