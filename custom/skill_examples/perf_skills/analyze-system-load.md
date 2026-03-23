---
name: analyze-system-load
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /system-load
- system load
- 系统负载
---

# 系统负载分析

## 功能
分析系统整体 CPU 负载，判断是否因高负载导致调度延迟。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_system_load.py \
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
- stdout: JSON 格式，包含 `overall_load_pct`, `per_cpu_load`, `needs_detailed_analysis`, `severity`, `has_issue` 字段
- 文件: `/workspace/perf_analysis_output/system_load.json`

## 判断标准
| 等级 | 负载 |
|------|------|
| 正常 (normal) | < 50% |
| 一般 (fair) | 50%-80% |
| 较高 (warning) | 80%-95% |
| 严重 (critical) | > 95% |

## 反思验证
执行完毕后，必须检查：
1. `overall_load_pct` 是否在 0-100% 范围内
2. per_cpu_load 中各核心负载是否合理（不应超过 100%）
3. 如果负载 > 80%，`needs_detailed_analysis` 应为 true
4. severity 是否与负载百分比和判断标准一致
5. 高负载可能解释 Runnable 或 Sleeping 偏高的原因

## 下一步
- 如果 `needs_detailed_analysis` 为 true（负载 > 80%），执行 `analyze-detailed-load`
- 否则，本分支分析完成
