---
name: analyze-io-details
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /io-details
- io analysis
- IO分析
---

# IO 详细分析

## 功能
分析进程的详细 IO 阻塞问题，包括磁盘读写等待、被阻塞的内核函数。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/analyze_io_details.py \
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
- stdout: JSON 格式，包含 `io_details`（按线程和 blocked_function 分组的 IO 等待）、`total_io_ms`、`severity`、`has_issue` 字段
- 文件: `/workspace/perf_analysis_output/io_details.json`

## 判断标准
| 等级 | IO 占比 |
|------|---------|
| 正常 (normal) | < 5% |
| 偏高 (warning) | 5%-10% |
| 严重 (critical) | > 10% |

## 反思验证
执行完毕后，必须检查：
1. blocked_function 是否为已知的 IO 相关内核函数（如 `do_page_fault`, `filemap_fault`, `ext4_file_read_iter`）
2. max_dur_ms 是否有异常大的值（超过 100ms 的单次 IO 等待通常意味着严重问题）
3. IO 等待是否集中在主线程 — 主线程的 IO 等待对用户体验影响最大
4. severity 是否与 IO 数据一致

## 下一步
IO 分支分析完成。继续执行其他分支或跳到内存分析。
