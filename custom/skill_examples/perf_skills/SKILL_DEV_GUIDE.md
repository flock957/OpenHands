# Skill 开发指南 - 降低幻觉、提高分析质量

## 一、什么是 Agent 幻觉，为什么它是问题

Agent（LLM）在执行 skill 时会"幻觉"，即：
- 看到 SQL 代码块后自己重写一个"更好"的版本，但语法错误或逻辑偏差
- 自行编造不存在的表名、列名
- 跳过脚本调用，直接用 Python 写分析逻辑
- 对结果做出不符合数据的结论

**后果：** 分析结果不可信，用户无法判断报告是否准确。

## 二、降低幻觉的 5 条规则

### 规则 1：Skill 只引导，不给代码
**错误做法（v1.0 的问题）：**
```markdown
## SQL 查询
```python
sql = f"SELECT ... FROM thread_state ..."
resp = requests.post(...)
```

Agent 看到这段代码会想"我来改进一下"，然后写出错误的变体。

**正确做法（v2.0）：**
```markdown
## 执行方式
```bash
python3 /workspace/.../script.py --process $NAME --start $START --end $END
```

Agent 只能照着调用，没有代码可以"改进"。

### 规则 2：明确写出约束
在每个 skill 开头加：
> **必须使用下方指定脚本，禁止自行编写 SQL 查询或修改脚本。**

这句话看似简单，但对 Agent 的行为有显著约束效果。

### 规则 3：给出预期输出格式
告诉 Agent 输出应该长什么样：
> stdout: JSON 格式，包含 `big_core_ratio`, `severity`, `has_issue` 字段

Agent 看到输出后能对照检查，发现不匹配时会报告而非编造。

### 规则 4：每步强制反思
```markdown
## 反思验证
执行完毕后，必须检查：
1. big_core_ratio 是否在 0-100% 范围内
2. severity 是否与判断标准一致
```

反思步骤迫使 Agent 在得出结论前回头看数据，减少"自信地给出错误结论"。

### 规则 5：参数来自上一步，不要猜
工作流中每个阶段的参数必须来自上一步的输出：
- `PROCESS_NAME` ← find-foreground-process 的输出
- `START_TIME`, `END_TIME` ← find-launch-range 的输出
- `BRANCHES` ← analyze-main-thread-state 的输出

Agent 不应该猜测任何值。

## 三、让分析更全面的检查清单

### 编写新 skill 时检查

- [ ] 脚本是否处理了"没有数据"的情况？（trace 中可能缺少某些事件）
- [ ] 输出是否区分了"没有问题"和"没有数据"？
- [ ] severity 判定阈值是否有文档依据？
- [ ] 是否考虑了边界条件？（时间范围为 0、进程不存在等）
- [ ] 输出 JSON 是否包含 `has_issue` 和 `severity` 字段？
- [ ] 反思验证步骤是否覆盖了常见的误判场景？

### 常见陷阱

| 陷阱 | 说明 | 解决方案 |
|------|------|----------|
| 空结果 ≠ 正常 | trace 中没有 cpufreq 数据不代表 CPU 频率正常 | 区分 "no_data" 和 "normal" |
| 百分比之和 | 各状态占比应接近 100% | 在反思步骤中验证 |
| 时间单位混淆 | Perfetto 用纳秒，人类习惯毫秒 | 脚本同时输出 _ns 和 _ms |
| fallback 方法精度 | 进程生命周期 ≠ 启动时间 | 在输出中标注 method |
| 大核识别失败 | 没有 cpufreq 数据时无法区分大小核 | 脚本应输出警告 |

## 四、Skill 模板（复制使用）

参见 `CLAUDE.md` 中的 "Skill 文件模板" 章节。

## 五、脚本开发模式

### 标准脚本结构
```python
#!/usr/bin/env python3
"""Script description."""
import argparse, json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args

def main():
    parser = argparse.ArgumentParser(description="...")
    add_common_args(parser)  # 添加 --port, --output-dir
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"SELECT ... WHERE ... AND ts >= {args.start} AND ts < {args.end}"
    result = query_tp(args.port, sql)
    rows = parse_columns(result)

    # 分析逻辑...
    severity = "normal"  # 根据数据判断

    output = {
        "key_metric": value,
        "details": [...],
        "severity": severity,
        "has_issue": severity != "normal",
    }
    save_result(output, "output_name.json", args.output_dir)
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
```

### severity 值的标准
| 值 | 含义 | 用于 |
|----|------|------|
| `excellent` | 优秀 | 启动时间、大核占比 |
| `good` | 良好 | 启动时间、大核占比 |
| `normal` | 正常 | 所有分析项 |
| `fair` | 一般 | CPU频率、系统负载 |
| `warning` | 警告 | 各状态偏高 |
| `poor` | 较差 | 启动时间、CPU频率 |
| `critical` | 严重 | 所有分析项 |

### generate_report.py 的 PRIORITY_ORDER
```python
PRIORITY_ORDER = {
    "critical": 0, "poor": 1, "high": 1,
    "warning": 2, "fair": 3, "normal": 4,
    "good": 5, "excellent": 6,
}
```
新增的 severity 值必须在此表中注册，否则报告排序会出错。

## 六、如何添加新的分析维度

**示例：添加"Binder 通信分析"**

### Step 1: 编写脚本

创建 `scripts/analyze_binder.py`：
```python
#!/usr/bin/env python3
"""Analyze Binder IPC performance."""
import argparse, json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from tp_query import query_tp, parse_columns, save_result, add_common_args

def main():
    parser = argparse.ArgumentParser(description="Analyze Binder transactions")
    add_common_args(parser)
    parser.add_argument("--process", required=True)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    args = parser.parse_args()

    sql = f"""
    SELECT s.name, COUNT(*) AS count, SUM(s.dur) AS total_dur_ns,
           CAST(SUM(s.dur) AS REAL) / 1e6 AS total_dur_ms
    FROM slice s
    JOIN track t ON s.track_id = t.id
    WHERE s.name LIKE 'binder%'
      AND s.ts >= {args.start} AND s.ts < {args.end}
    GROUP BY s.name ORDER BY total_dur_ns DESC
    """
    rows = parse_columns(query_tp(args.port, sql))

    total_ms = sum(r.get("total_dur_ms", 0) for r in rows)
    severity = "critical" if total_ms > 500 else "warning" if total_ms > 100 else "normal"

    output = {
        "binder_transactions": rows,
        "total_binder_ms": round(total_ms, 2),
        "severity": severity,
        "has_issue": severity != "normal",
    }
    save_result(output, "binder.json", args.output_dir)
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
```

### Step 2: 编写 skill 文件

创建 `analyze-binder.md`（遵循模板，不嵌入代码）。

### Step 3: 注册到工作流

在 `perf-analysis-workflow.md` 的合适阶段添加调用。

### Step 4: 测试

```bash
python3 scripts/analyze_binder.py --process com.example.app --start 123 --end 456 --port 9001
```

### Step 5: 注册到数据库

使用 `register_skills.py` 注册新 skill。
