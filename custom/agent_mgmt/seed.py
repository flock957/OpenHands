"""Auto-seed built-in agents on first startup."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from custom.agent_mgmt.models import StoredAgent

_logger = logging.getLogger(__name__)

PERF_AGENT_NAME = '性能分析 Agent'

PERF_AGENT_DESCRIPTION = (
    '自动化 9 阶段 Perfetto trace 性能分析工作流。'
    '上传 Android trace 文件，选择分析方向，自动执行完整分析并生成 HTML 报告。'
)

PERF_AGENT_USAGE = """\
## 使用方式

1. 在 Agent 详情页点击「开始分析」
2. 输入 trace 文件路径（如 `/workspace/trace.perfetto-trace`）
3. 选择分析方向（完整分析 / CPU / 调度 / IO / 内存 / 渲染 等）
4. 点击「Analyze」开始分析

## 分析流程（9 阶段）

1. 初始化 Trace Processor
2. 查找前台进程
3. 确定启动时间范围
4. 主线程状态分析
5. 条件分支分析（Running/Runnable/Sleeping/IO/Non-IO）
6. 内存分析
7. 渲染分析
8. 清理 Trace Processor
9. 生成 HTML 报告

## 输出

- `/workspace/perf_analysis_output/full_report.html` — 完整报告
- `/workspace/perf_analysis_output/issue_report.html` — 问题摘要
"""


def _load_workflow_content() -> str:
    """Load perf-analysis-workflow.md as system_prompt."""
    workflow_path = (
        Path(__file__).parent.parent
        / 'skill_examples'
        / 'perf_skills'
        / 'perf-analysis-workflow.md'
    )
    if workflow_path.exists():
        return workflow_path.read_text(encoding='utf-8')
    _logger.warning(f'Workflow skill not found: {workflow_path}')
    return ''


async def seed_perf_agent(db: AsyncSession) -> None:
    """Create the built-in Performance Analysis Agent if it doesn't exist."""
    try:
        result = await db.execute(
            select(StoredAgent).where(StoredAgent.name == PERF_AGENT_NAME)
        )
        existing = result.scalars().first()
        if existing is not None:
            # Ensure config_json and usage_instructions are set
            changed = False
            if not existing.config_json:
                existing.config_json = json.dumps({'agent_type': 'perf-analysis'})
                changed = True
            if not existing.usage_instructions:
                existing.usage_instructions = PERF_AGENT_USAGE
                changed = True
            if not existing.system_prompt:
                existing.system_prompt = _load_workflow_content()
                changed = True
            if changed:
                await db.commit()
                _logger.info(f'Updated existing agent: {PERF_AGENT_NAME}')
            return

        agent = StoredAgent(
            id=uuid4(),
            name=PERF_AGENT_NAME,
            description=PERF_AGENT_DESCRIPTION,
            system_prompt=_load_workflow_content(),
            category='performance',
            tags=json.dumps(['perfetto', 'trace', 'android', 'performance', '性能分析']),
            config_json=json.dumps({'agent_type': 'perf-analysis'}),
            usage_instructions=PERF_AGENT_USAGE,
            is_enabled=True,
            created_by='system',
        )
        db.add(agent)
        await db.commit()
        _logger.info(f'Seeded built-in agent: {PERF_AGENT_NAME}')

    except Exception as e:
        _logger.warning(f'Failed to seed perf agent: {e}', exc_info=True)
        await db.rollback()
