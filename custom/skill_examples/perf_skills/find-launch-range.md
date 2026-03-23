---
name: find-launch-range
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /find-launch
- launch range
- 启动时间范围
---

# 查找应用启动时间范围

## 功能
从 Perfetto trace 中查找指定应用的启动时间范围（start_time 和 end_time，单位纳秒）。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 时间单位始终为纳秒 (ns)，传递给后续 skill 时不要转换单位。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/find_launch_range.py \
  --process <process_name> \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--process` | 是 | 目标进程名称（来自上一步） |
| `--port` | 否 | Trace Processor HTTP 端口，默认 9001 |
| `--output-dir` | 否 | 输出目录，默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `start_time`, `end_time`, `duration_ms`, `duration_ns`, `method`, `severity` 字段
- 文件: `/workspace/perf_analysis_output/launch_range.json`

## 启动时间判断标准
| 等级 | 范围 |
|------|------|
| 优秀 (excellent) | < 1000ms |
| 良好 (good) | 1000-1500ms |
| 一般 (fair) | 1500-2000ms |
| 较差 (poor) | 2000-3000ms |
| 严重 (critical) | > 3000ms |

## 反思验证
执行完毕后，必须检查：
1. `start_time` 和 `end_time` 都是正整数，且 `end_time > start_time`
2. `duration_ms` 是否在合理范围内（通常 200ms - 30000ms）— 过小或过大都可能说明检测有误
3. 如果使用了 fallback 方法（进程生命周期而非 launch slice），结果可能不够精确，需在报告中注明
4. severity 判定是否与 duration_ms 和上述判断标准一致
5. 确认输出文件已正确写入

## 下一步
获取时间范围后，执行 `analyze-main-thread-state` 分析主线程状态分布。
