---
name: trace-processor-cleanup
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /trace-cleanup
- trace cleanup
- 清理trace
---

# Trace Processor 清理

## 功能
停止 Trace Processor HTTP 服务，释放系统资源。分析结果文件保留在输出目录中。

## 约束
- **必须使用下方指定脚本，禁止自行编写清理命令。**
- 此步骤在所有分析完成后、生成报告前执行。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/trace_processor_cleanup.py \
  --output-dir /workspace/perf_analysis_output
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--output-dir` | 否 | 状态文件所在目录，默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: 清理状态信息
- Trace Processor 进程已终止
- 分析结果 JSON 文件保留在 `/workspace/perf_analysis_output/`

## 反思验证
执行完毕后，必须检查：
1. 用 `curl -s http://localhost:9001/status` 确认服务已不可达（应返回连接失败）
2. 确认 `/workspace/perf_analysis_output/` 目录下的分析结果 JSON 文件仍然存在
3. 如果清理失败（进程无法终止），尝试 `pkill -9 -f trace_processor_shell`

## 下一步
清理完成后，执行报告生成：`python3 /workspace/custom/skill_examples/perf_skills/scripts/generate_report.py`
