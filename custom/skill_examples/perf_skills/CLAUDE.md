# HiClaw 性能分析 Skill 系统 - 开发规范

## 项目概述

基于 OpenHands 平台的 Android 性能分析 Agent。用户上传 Perfetto trace 文件，选择分析方向，Agent 自动执行 9 阶段分析工作流并生成 HTML 报告。

## 目录结构

```
custom/skill_examples/perf_skills/
├── perf-analysis-workflow.md    # 主工作流（Agent 入口）
├── *.md                         # 各阶段 skill 定义
├── scripts/                     # Python 分析脚本（Agent 只调用不修改）
│   ├── tp_query.py              # 公共库：查询 Trace Processor
│   ├── trace_processor_init.py  # 初始化
│   ├── find_foreground_process.py
│   ├── find_launch_range.py
│   ├── analyze_*.py             # 各分析脚本
│   ├── generate_report.py       # HTML 报告生成
│   └── trace_processor_cleanup.py
├── SKILL_DEV_GUIDE.md           # Skill 开发指南
└── CLAUDE.md                    # 本文件
```

## 核心开发原则

### 1. Skill 文件只做引导，不做执行
- Skill `.md` 文件的作用是告诉 Agent **调用哪个脚本、传什么参数、如何验证结果**
- **绝对不要**在 skill 文件中嵌入可执行代码（SQL、Python）
- Agent 看到代码块会倾向于自己写代码而非调用脚本，这是幻觉的主要来源

### 2. 每个 skill 必须包含反思验证步骤
- 脚本执行后，Agent 必须检查输出是否合理
- 包括：数值范围、字段完整性、severity 与数据的一致性
- 发现异常时报告而非忽略

### 3. 脚本输出格式统一
所有分析脚本的 JSON 输出必须包含：
```json
{
  "severity": "normal|fair|warning|poor|critical|good|excellent",
  "has_issue": true/false,
  // ... 其他分析数据
}
```

### 4. 错误处理
- 脚本失败时 Agent 应停止并报告，不要跳过
- 不要自行编写替代代码
- 不要修改脚本内容

## Skill 文件模板

```markdown
---
name: skill-name
type: knowledge
version: 2.0.0
agent: CodeActAgent
triggers:
- /trigger-command
- 中文触发词
- english trigger
---

# Skill 标题

## 功能
一句话描述功能。

## 约束
- **必须使用下方指定脚本，禁止自行编写代码或修改脚本。**

## 执行方式
\```bash
python3 /workspace/custom/skill_examples/perf_skills/scripts/xxx.py \
  --arg1 <value> --arg2 <value>
\```

### 参数说明
| 参数 | 必需 | 说明 |
|------|------|------|
| `--arg1` | 是 | 说明 |

## 预期输出
- stdout: JSON 格式，包含 xxx 字段
- 文件: `/workspace/perf_analysis_output/xxx.json`

## 判断标准（如适用）
| 等级 | 条件 |
|------|------|
| 正常 | ... |

## 反思验证
执行完毕后，必须检查：
1. ...
2. ...

## 下一步
下一个要执行的 skill。
```

## 添加新分析维度的流程

1. 编写 Python 脚本放入 `scripts/`，遵循现有脚本的模式（argparse + tp_query + JSON 输出）
2. 确保输出包含 `has_issue` 和 `severity` 字段
3. 编写 skill `.md` 文件，**只引用脚本不嵌入代码**
4. 在 `perf-analysis-workflow.md` 中注册新阶段
5. 在 `generate_report.py` 的 PRIORITY_ORDER 中确保新 severity 值被支持
6. 用真实 trace 文件测试脚本
7. 注册到技能数据库

## 启动命令

```bash
export PATH="/home/wq/miniforge3/bin:$PATH"
make run BACKEND_HOST="0.0.0.0" BACKEND_PORT="12000" FRONTEND_PORT="12001"
```

## Git 工作流
- 开发分支：`testwq`（基于 hiclaw/test）
- 推送前必须确认
- 不要混合不同分支的代码
