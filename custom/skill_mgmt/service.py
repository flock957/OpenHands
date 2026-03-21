"""Skill management service — CRUD operations on skills, versions, and scripts."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from custom.skill_mgmt.models import (
    StoredSkill,
    StoredSkillVersion,
    StoredSkillScript,
    SkillCreate,
    SkillUpdate,
    SkillVersionCreate,
    ScriptCreate,
    ScriptUpdate,
    SkillInfo,
    SkillDetail,
    SkillVersionInfo,
    ScriptInfo,
)


def _json_loads(val: str | None) -> list[str]:
    if not val:
        return []
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return []


def _row_to_skill_info(row: StoredSkill) -> SkillInfo:
    return SkillInfo(
        id=str(row.id),
        name=row.name,
        description=row.description,
        category=row.category,
        skill_type=row.skill_type,
        triggers=_json_loads(row.triggers),
        tags=_json_loads(row.tags),
        is_global=row.is_global,
        is_active=row.is_active,
        created_by=row.created_by,
        current_version=row.current_version,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _row_to_version_info(row: StoredSkillVersion) -> SkillVersionInfo:
    return SkillVersionInfo(
        id=str(row.id),
        skill_id=str(row.skill_id),
        version=row.version,
        content=row.content,
        changelog=row.changelog,
        performance_notes=row.performance_notes,
        is_current=row.is_current,
        created_by=row.created_by,
        created_at=row.created_at,
    )


def _row_to_script_info(row: StoredSkillScript) -> ScriptInfo:
    return ScriptInfo(
        id=str(row.id),
        skill_id=str(row.skill_id),
        filename=row.filename,
        language=row.language,
        content=row.content,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SkillService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Skill CRUD ────────────────────────────────────────────

    async def list_skills(
        self,
        search: str | None = None,
        category: str | None = None,
        tag: str | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SkillInfo]:
        stmt = select(StoredSkill)

        if search:
            pattern = f'%{search}%'
            stmt = stmt.where(
                or_(
                    StoredSkill.name.ilike(pattern),
                    StoredSkill.description.ilike(pattern),
                )
            )
        if category:
            stmt = stmt.where(StoredSkill.category == category)
        if tag:
            stmt = stmt.where(StoredSkill.tags.ilike(f'%"{tag}"%'))
        if is_active is not None:
            stmt = stmt.where(StoredSkill.is_active == is_active)

        stmt = stmt.order_by(StoredSkill.updated_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return [_row_to_skill_info(row) for row in result.scalars().all()]

    async def count_skills(
        self,
        search: str | None = None,
        category: str | None = None,
        is_active: bool | None = None,
    ) -> int:
        stmt = select(func.count(StoredSkill.id))
        if search:
            pattern = f'%{search}%'
            stmt = stmt.where(
                or_(
                    StoredSkill.name.ilike(pattern),
                    StoredSkill.description.ilike(pattern),
                )
            )
        if category:
            stmt = stmt.where(StoredSkill.category == category)
        if is_active is not None:
            stmt = stmt.where(StoredSkill.is_active == is_active)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_skill(self, skill_id: str) -> SkillDetail | None:
        result = await self.db.execute(
            select(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None

        info = _row_to_skill_info(row)

        # Get current version content
        ver_result = await self.db.execute(
            select(StoredSkillVersion)
            .where(StoredSkillVersion.skill_id == UUID(skill_id))
            .where(StoredSkillVersion.is_current == True)
        )
        current_ver = ver_result.scalar_one_or_none()
        content = current_ver.content if current_ver else ''

        # Get all versions
        vers_result = await self.db.execute(
            select(StoredSkillVersion)
            .where(StoredSkillVersion.skill_id == UUID(skill_id))
            .order_by(StoredSkillVersion.version.desc())
        )
        versions = [_row_to_version_info(v) for v in vers_result.scalars().all()]

        # Get scripts
        scripts_result = await self.db.execute(
            select(StoredSkillScript)
            .where(StoredSkillScript.skill_id == UUID(skill_id))
            .order_by(StoredSkillScript.filename)
        )
        scripts = [_row_to_script_info(s) for s in scripts_result.scalars().all()]

        return SkillDetail(
            **info.model_dump(),
            content=content,
            versions=versions,
            scripts=scripts,
        )

    async def create_skill(self, data: SkillCreate, user_id: str | None = None) -> SkillDetail:
        now = datetime.now(UTC)
        skill_id = uuid4()

        skill = StoredSkill(
            id=skill_id,
            name=data.name,
            description=data.description,
            category=data.category,
            skill_type=data.skill_type,
            triggers=json.dumps(data.triggers),
            tags=json.dumps(data.tags),
            is_global=data.is_global,
            is_active=True,
            created_by=user_id,
            current_version=1,
            created_at=now,
            updated_at=now,
        )
        self.db.add(skill)

        # Create first version
        version = StoredSkillVersion(
            id=uuid4(),
            skill_id=skill_id,
            version=1,
            content=data.content,
            changelog='Initial version',
            is_current=True,
            created_by=user_id,
            created_at=now,
        )
        self.db.add(version)
        await self.db.commit()

        return await self.get_skill(str(skill_id))  # type: ignore

    async def update_skill(self, skill_id: str, data: SkillUpdate) -> SkillDetail | None:
        result = await self.db.execute(
            select(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None

        updates: dict = {'updated_at': datetime.now(UTC)}
        if data.description is not None:
            updates['description'] = data.description
        if data.category is not None:
            updates['category'] = data.category
        if data.triggers is not None:
            updates['triggers'] = json.dumps(data.triggers)
        if data.tags is not None:
            updates['tags'] = json.dumps(data.tags)
        if data.is_global is not None:
            updates['is_global'] = data.is_global
        if data.is_active is not None:
            updates['is_active'] = data.is_active

        await self.db.execute(
            update(StoredSkill).where(StoredSkill.id == UUID(skill_id)).values(**updates)
        )
        await self.db.commit()
        return await self.get_skill(skill_id)

    async def delete_skill(self, skill_id: str) -> bool:
        result = await self.db.execute(
            select(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        if not result.scalar_one_or_none():
            return False

        await self.db.execute(
            delete(StoredSkillScript).where(StoredSkillScript.skill_id == UUID(skill_id))
        )
        await self.db.execute(
            delete(StoredSkillVersion).where(StoredSkillVersion.skill_id == UUID(skill_id))
        )
        await self.db.execute(
            delete(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        await self.db.commit()
        return True

    # ─── Version Management ─────────────────────────────────────

    async def create_version(
        self, skill_id: str, data: SkillVersionCreate, user_id: str | None = None
    ) -> SkillVersionInfo | None:
        result = await self.db.execute(
            select(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        skill = result.scalar_one_or_none()
        if not skill:
            return None

        new_version = skill.current_version + 1
        now = datetime.now(UTC)

        # Mark old versions as not current
        await self.db.execute(
            update(StoredSkillVersion)
            .where(StoredSkillVersion.skill_id == UUID(skill_id))
            .values(is_current=False)
        )

        ver = StoredSkillVersion(
            id=uuid4(),
            skill_id=UUID(skill_id),
            version=new_version,
            content=data.content,
            changelog=data.changelog,
            performance_notes=data.performance_notes,
            is_current=True,
            created_by=user_id,
            created_at=now,
        )
        self.db.add(ver)

        await self.db.execute(
            update(StoredSkill)
            .where(StoredSkill.id == UUID(skill_id))
            .values(current_version=new_version, updated_at=now)
        )
        await self.db.commit()
        return _row_to_version_info(ver)

    async def get_version(self, version_id: str) -> SkillVersionInfo | None:
        result = await self.db.execute(
            select(StoredSkillVersion).where(StoredSkillVersion.id == UUID(version_id))
        )
        row = result.scalar_one_or_none()
        return _row_to_version_info(row) if row else None

    async def rollback_version(self, skill_id: str, version_id: str) -> SkillDetail | None:
        result = await self.db.execute(
            select(StoredSkillVersion).where(
                StoredSkillVersion.id == UUID(version_id),
                StoredSkillVersion.skill_id == UUID(skill_id),
            )
        )
        target = result.scalar_one_or_none()
        if not target:
            return None

        # Mark all as not current
        await self.db.execute(
            update(StoredSkillVersion)
            .where(StoredSkillVersion.skill_id == UUID(skill_id))
            .values(is_current=False)
        )
        # Mark target as current
        await self.db.execute(
            update(StoredSkillVersion)
            .where(StoredSkillVersion.id == UUID(version_id))
            .values(is_current=True)
        )
        await self.db.execute(
            update(StoredSkill)
            .where(StoredSkill.id == UUID(skill_id))
            .values(current_version=target.version, updated_at=datetime.now(UTC))
        )
        await self.db.commit()
        return await self.get_skill(skill_id)

    # ─── Script Management ──────────────────────────────────────

    async def add_script(
        self, skill_id: str, data: ScriptCreate
    ) -> ScriptInfo | None:
        result = await self.db.execute(
            select(StoredSkill).where(StoredSkill.id == UUID(skill_id))
        )
        if not result.scalar_one_or_none():
            return None

        now = datetime.now(UTC)
        script = StoredSkillScript(
            id=uuid4(),
            skill_id=UUID(skill_id),
            filename=data.filename,
            language=data.language or self._detect_language(data.filename),
            content=data.content,
            description=data.description,
            created_at=now,
            updated_at=now,
        )
        self.db.add(script)
        await self.db.commit()
        return _row_to_script_info(script)

    async def update_script(self, script_id: str, data: ScriptUpdate) -> ScriptInfo | None:
        result = await self.db.execute(
            select(StoredSkillScript).where(StoredSkillScript.id == UUID(script_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None

        updates: dict = {'updated_at': datetime.now(UTC)}
        if data.filename is not None:
            updates['filename'] = data.filename
        if data.language is not None:
            updates['language'] = data.language
        if data.content is not None:
            updates['content'] = data.content
        if data.description is not None:
            updates['description'] = data.description

        await self.db.execute(
            update(StoredSkillScript)
            .where(StoredSkillScript.id == UUID(script_id))
            .values(**updates)
        )
        await self.db.commit()

        result = await self.db.execute(
            select(StoredSkillScript).where(StoredSkillScript.id == UUID(script_id))
        )
        return _row_to_script_info(result.scalar_one())

    async def delete_script(self, script_id: str) -> bool:
        result = await self.db.execute(
            select(StoredSkillScript).where(StoredSkillScript.id == UUID(script_id))
        )
        if not result.scalar_one_or_none():
            return False
        await self.db.execute(
            delete(StoredSkillScript).where(StoredSkillScript.id == UUID(script_id))
        )
        await self.db.commit()
        return True

    # ─── Categories ──────────────────────────────────────────────

    async def list_categories(self) -> list[str]:
        result = await self.db.execute(
            select(StoredSkill.category)
            .where(StoredSkill.category.isnot(None))
            .distinct()
            .order_by(StoredSkill.category)
        )
        return [row for row in result.scalars().all() if row]

    @staticmethod
    def _detect_language(filename: str) -> str:
        ext_map = {
            '.py': 'python',
            '.sh': 'bash',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.java': 'java',
            '.md': 'markdown',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
        }
        for ext, lang in ext_map.items():
            if filename.endswith(ext):
                return lang
        return 'text'
