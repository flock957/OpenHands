---
name: trace-processor-init
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /trace-init
- trace processor init
- 初始化trace
---

# Trace Processor 初始化

## 功能
初始化 Perfetto Trace Processor HTTP 服务，加载 trace 文件供后续 SQL 查询分析。

## 约束
- **必须使用下方指定脚本，禁止自行编写初始化代码或修改脚本。**
- 如果脚本执行失败，报告错误并停止，不要尝试绕过。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/trace_processor_init.py \
  --trace <trace_file_path> \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--trace` | 是 | trace 文件的完整路径 |
| `--port` | 否 | HTTP 端口，默认 9001 |
| `--output-dir` | 否 | 输出目录，默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `port`, `pid`, `trace_file`, `status` 字段
- 文件: `/workspace/perf_analysis_output/tp_state.json`
- Trace Processor HTTP 服务运行在 `localhost:9001`

## 反思验证
执行完毕后，必须检查：
1. stdout 输出是否包含 `"status": "ready"` — 如果不是，说明初始化失败，停止后续分析
2. 用 `curl -s http://localhost:9001/status` 验证服务是否可达
3. 确认 `tp_state.json` 已写入且包含正确的 port 和 pid
4. 如果 trace 文件不存在或路径错误，应在此步骤发现并报告

## 下一步
初始化成功后，执行 `find-foreground-process` 确定分析目标进程。
