---
name: analyze-cpu-frequency
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /cpu-freq
- cpu frequency
- CPU频率
---

# CPU 频率分析

## 功能
分析 CPU 频率和限频（thermal throttling）情况，判断是否存在降频影响性能。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_cpu_frequency.py \
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
- stdout: JSON 格式，包含 `per_cpu_freq`（各核心 min/max/avg 频率）、`thermal_events`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/cpu_frequency.json`

## 判断标准
| 等级 | 条件 |
|------|------|
| 正常 (normal) | 频率维持较高水平（> 1.5GHz） |
| 一般 (fair) | 频率波动较大 |
| 较差 (poor) | 频率受限（< 1GHz） |
| 严重 (critical) | 持续限频 |

## 反思验证
执行完毕后，必须检查：
1. 频率值是否在合理范围内（Android 设备通常 300MHz - 3GHz）
2. 如果有 thermal_events，检查其时间是否在分析范围内
3. 如果所有 CPU 频率都很低，可能是限频问题，应在结论中强调
4. severity 是否与频率数据和判断标准一致

## 下一步
继续执行 Running 分支的下一个分析：`analyze-compile-level`。
