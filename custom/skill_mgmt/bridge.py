"""Bridge between custom skill management and OpenHands native skill system.

Loads skills from our database and converts them to native Skill objects
that can be injected into the agent context alongside built-in skills.

Uses raw sqlite3 (sync) to avoid SQLAlchemy ORM / aiosqlite session issues
that caused the bridge to silently return 0 skills.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from pathlib import Path

from openhands.sdk.context.skills import Skill
from openhands.sdk.context.skills.trigger import KeywordTrigger, TaskTrigger

_logger = logging.getLogger(__name__)


def _get_db_path() -> str:
    persistence_dir = os.environ.get('OH_PERSISTENCE_DIR', str(Path.home() / '.openhands'))
    return str(Path(persistence_dir) / 'openhands.db')


async def load_custom_skills() -> list[Skill]:
    """Load all active skills from the custom skill database.

    Uses raw sqlite3 to guarantee we see committed data regardless of
    SQLAlchemy engine / session state in the host process.
    """
    try:
        db_path = _get_db_path()
        if not os.path.exists(db_path):
            _logger.debug(f'Skill database not found: {db_path}')
            return []

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()

            # Check if our tables exist
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='managed_skill'")
            if not cur.fetchone():
                _logger.debug('managed_skill table does not exist')
                return []

            # Load active skills
            cur.execute(
                'SELECT id, name, description, triggers FROM managed_skill WHERE is_active = 1'
            )
            skill_rows = cur.fetchall()

            skills: list[Skill] = []
            for row in skill_rows:
                skill_id = row['id']
                name = row['name']
                description = row['description']
                triggers = json.loads(row['triggers']) if row['triggers'] else []

                # Get current version content
                cur.execute(
                    'SELECT content FROM skill_version WHERE skill_id = ? AND is_current = 1',
                    (skill_id,),
                )
                ver_row = cur.fetchone()
                content = ver_row['content'] if ver_row else ''

                # Get scripts
                cur.execute(
                    'SELECT filename, language, content, description FROM skill_script WHERE skill_id = ? ORDER BY filename',
                    (skill_id,),
                )
                scripts = cur.fetchall()
                if scripts:
                    content += "\n\n---\n\n## 关联脚本\n\n"
                    content += "以下脚本文件是此 Skill 的组成部分。执行任务时，请先将脚本保存到工作目录再运行。\n\n"
                    for script in scripts:
                        lang = script['language'] or ''
                        content += f"### 文件: `{script['filename']}`\n"
                        if script['description']:
                            content += f"{script['description']}\n\n"
                        content += f"```{lang}\n{script['content']}\n```\n\n"

                # Determine trigger type
                trigger = None
                if triggers:
                    if any(t.startswith('/') for t in triggers):
                        trigger = TaskTrigger(triggers=triggers)
                    else:
                        trigger = KeywordTrigger(keywords=triggers)

                skills.append(Skill(
                    name=name,
                    content=content,
                    trigger=trigger,
                    source='custom-db',
                    description=description,
                    is_agentskills_format=False,
                ))

            _logger.info(f'Loaded {len(skills)} custom skills from database: {[s.name for s in skills]}')
            return skills

        finally:
            conn.close()

    except Exception as e:
        _logger.warning(f'Failed to load custom skills: {e}', exc_info=True)
        return []


def load_file_skills() -> list[Skill]:
    """Load skill .md files from custom/skill_examples/perf_skills/ directory."""
    import pathlib
    import frontmatter

    skills: list[Skill] = []
    skill_dirs = [
        pathlib.Path(__file__).parent.parent / 'skill_examples' / 'perf_skills',
    ]

    for skill_dir in skill_dirs:
        if not skill_dir.exists():
            continue
        for md_file in sorted(skill_dir.glob('*.md')):
            try:
                post = frontmatter.load(str(md_file))
                meta = post.metadata or {}
                name = meta.get('name', md_file.stem)
                triggers = meta.get('triggers', [])
                content = post.content

                trigger = None
                if triggers:
                    if any(t.startswith('/') for t in triggers):
                        trigger = TaskTrigger(triggers=triggers)
                    else:
                        trigger = KeywordTrigger(keywords=triggers)

                skills.append(Skill(
                    name=name,
                    content=content,
                    trigger=trigger,
                    source='file-skill',
                    is_agentskills_format=False,
                ))
            except Exception as e:
                _logger.warning(f'Failed to load skill file {md_file}: {e}')

    _logger.info(f'Loaded {len(skills)} file-based skills: {[s.name for s in skills]}')
    return skills
