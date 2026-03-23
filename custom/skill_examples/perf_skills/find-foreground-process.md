---
name: find-foreground-process
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /find-foreground
- foreground process
- 前台进程
---

# 查找前台进程

## 功能
从 Perfetto trace 中查找前台运行的应用进程。优先使用 FocusedApp，失败时回退到基于线程 Running 时长的猜测。

## 约束
- **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**
- 不要猜测进程名，必须从 trace 数据中获取。

## 执行方式

```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/find_foreground_process.py \
  --port 9001
```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--port` | 否 | Trace Processor HTTP 端口，默认 9001 |
| `--output-dir` | 否 | 输出目录，默认 `/workspace/perf_analysis_output` |

## 预期输出
- stdout: JSON 格式，包含 `process_name`, `pid`, `method`（"focused_app" 或 "fallback"）字段
- 文件: `/workspace/perf_analysis_output/target_process.json`

## 反思验证
执行完毕后，必须检查：
1. `process_name` 是否看起来像一个合理的 Android 应用包名（如 `com.xxx.xxx`）
2. 如果 method 是 "fallback"，检查返回的进程是否确实是用户应用而非系统进程
3. 如果返回空结果，说明 trace 中可能没有用户应用活动，应报告并询问用户是否指定进程名
4. 确认输出文件已正确写入

## 下一步
获取进程名后，执行 `find-launch-range` 确定应用启动的时间范围。
