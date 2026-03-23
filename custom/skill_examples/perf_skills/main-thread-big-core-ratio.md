---
name: main-thread-big-core-ratio
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /big-core-ratio
- big core ratio
- 大核占比
---

# 主线程大核运行分析

## 功能
分析主线程在大核（big core）上的运行时间占比，判断 CPU 调度是否合理。ARM big.LITTLE 架构中，大核频率更高、性能更强。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 大核/小核的识别由脚本根据 CPU 最大频率自动判断，不要手动指定。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_big_core_ratio.py \
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
- stdout: JSON 格式，包含 `big_core_ratio`, `per_cpu_running`, `big_cores`, `little_cores`, `severity`, `has_issue` 字段
- 文件: `/workspace/perf_analysis_output/big_core_ratio.json`

## 判断标准
| 等级 | 大核占比 |
|------|----------|
| 优秀 (excellent) | > 80% |
| 良好 (good) | 60%-80% |
| 一般 (fair) | 40%-60% |
| 较差 (poor) | < 40% |

## 反思验证
执行完毕后，必须检查：
1. `big_core_ratio` 是否在 0-100% 范围内
2. `big_cores` 和 `little_cores` 的 CPU 编号是否合理（通常 8 核设备有 4+4 或 1+3+4 配置）
3. 所有 per_cpu_running 时间之和是否接近主线程 Running 总时间
4. severity 是否与 big_core_ratio 和判断标准一致
5. 如果 trace 中没有 cpufreq 数据，脚本可能无法区分大小核，检查是否有相关警告

## 下一步
继续执行 Running 分支的下一个分析：`analyze-cpu-frequency`。
