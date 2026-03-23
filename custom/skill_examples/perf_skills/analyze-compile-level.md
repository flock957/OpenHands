---
name: analyze-compile-level
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /compile-level
- compile level
- 编译优化级别
---

# 编译优化级别分析

## 功能
分析应用的编译优化级别（AOT/JIT/Interpreted），判断编译状态是否影响运行性能。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_compile_level.py \
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
- stdout: JSON 格式，包含 `compile_activities`（JIT/AOT/Interpreter 活动）、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/compile_level.json`

## 反思验证
执行完毕后，必须检查：
1. 如果没有找到任何编译相关活动，可能是 trace 未包含该类事件，而非"没有问题"——应在结论中说明
2. 如果 JIT 编译耗时很长，可能意味着应用未被充分 AOT 编译
3. 数据量（count, duration_ms）是否在合理范围内
4. severity 判定是否与数据一致

## 下一步
继续执行 Running 分支的最后一个分析：`analyze-jit-thread`。
