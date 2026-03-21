"""Database session management for skill management.

Uses the same SQLite database as OpenHands (~/.openhands/openhands.db).
Creates tables on first use if they don't exist.
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from custom.skill_mgmt.models import StoredSkill, StoredSkillVersion, StoredSkillScript
from openhands.app_server.utils.sql_utils import Base

_engine = None
_session_factory = None
_tables_created = False


def _get_db_url() -> str:
    persistence_dir = os.environ.get('OH_PERSISTENCE_DIR', str(Path.home() / '.openhands'))
    db_path = Path(persistence_dir) / 'openhands.db'
    return f'sqlite+aiosqlite:///{db_path}'


async def _ensure_tables():
    global _engine, _session_factory, _tables_created

    if _engine is None:
        _engine = create_async_engine(_get_db_url(), echo=False)
        _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

    if not _tables_created:
        async with _engine.begin() as conn:
            # Create only our custom tables, don't touch existing ones
            await conn.run_sync(
                Base.metadata.create_all,
                tables=[
                    StoredSkill.__table__,
                    StoredSkillVersion.__table__,
                    StoredSkillScript.__table__,
                ],
            )
        _tables_created = True


async def get_skill_db() -> AsyncSession:
    await _ensure_tables()
    assert _session_factory is not None
    return _session_factory()
