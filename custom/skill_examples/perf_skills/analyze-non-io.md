---
name: analyze-non-io
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /non-io
- non-io analysis
- Non-IO分析
---

# Non-IO 阻塞分析

## 功能
分析进程的 Non-IO 阻塞问题，如锁竞争（futex）、信号等待等。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_non_io.py \
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
- stdout: JSON 格式，包含 `non_io_details`（按线程和 blocked_function 分组）、`total_non_io_ms`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/non_io.json`

## 判断标准
| 等级 | Non-IO 占比 |
|------|------------|
| 正常 (normal) | < 5% |
| 偏高 (warning) | 5%-10% |
| 严重 (critical) | > 10% |

## 反思验证
执行完毕后，必须检查：
1. blocked_function 是否为已知的锁/同步相关函数（如 `futex_wait`, `mutex_lock`, `rwsem_down_read_slowpath`）
2. 是否有大量的 futex 等待 — 这通常意味着锁竞争
3. 阻塞是否集中在特定线程 — 有助于定位问题代码
4. severity 是否与 Non-IO 数据一致

## 下一步
Non-IO 分支分析完成。继续执行其他分支或跳到内存分析。
