"""Agent management service - CRUD operations for agents."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from custom.agent_mgmt.models import (
    AgentCreate, AgentDetail, AgentFavorite, AgentInfo,
    AgentSkillLink, AgentUpdate, SkillBrief, StoredAgent,
)
from custom.skill_mgmt.models import StoredSkill


class AgentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_agents(
        self,
        search: str | None = None,
        category: str | None = None,
        tag: str | None = None,
        is_enabled: bool | None = None,
        created_by: str | None = None,
        sort_by: str = 'created_at',
        sort_order: str = 'desc',
        limit: int = 50,
        offset: int = 0,
    ) -> list[AgentInfo]:
        stmt = select(StoredAgent)

        if search:
            pattern = f'%{search}%'
            stmt = stmt.where(
                StoredAgent.name.ilike(pattern) | StoredAgent.description.ilike(pattern)
            )
        if category:
            stmt = stmt.where(StoredAgent.category == category)
        if tag:
            stmt = stmt.where(StoredAgent.tags.ilike(f'%"{tag}"%'))
        if is_enabled is not None:
            stmt = stmt.where(StoredAgent.is_enabled == is_enabled)
        if created_by:
            stmt = stmt.where(StoredAgent.created_by == created_by)

        order_col = getattr(StoredAgent, sort_by, StoredAgent.created_at)
        stmt = stmt.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
        stmt = stmt.limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        rows = result.scalars().all()
        return [self._to_info(r) for r in rows]

    async def count_agents(
        self,
        search: str | None = None,
        category: str | None = None,
        is_enabled: bool | None = None,
    ) -> int:
        stmt = select(func.count(StoredAgent.id))
        if search:
            pattern = f'%{search}%'
            stmt = stmt.where(
                StoredAgent.name.ilike(pattern) | StoredAgent.description.ilike(pattern)
            )
        if category:
            stmt = stmt.where(StoredAgent.category == category)
        if is_enabled is not None:
            stmt = stmt.where(StoredAgent.is_enabled == is_enabled)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_agent(self, agent_id: str, user_id: str | None = None) -> AgentDetail | None:
        stmt = select(StoredAgent).where(StoredAgent.id == agent_id)
        result = await self.db.execute(stmt)
        agent = result.scalar_one_or_none()
        if not agent:
            return None

        # Get linked skills with details
        skill_stmt = (
            select(AgentSkillLink.skill_id, StoredSkill.name, StoredSkill.description)
            .outerjoin(StoredSkill, AgentSkillLink.skill_id == StoredSkill.id)
            .where(AgentSkillLink.agent_id == agent_id)
            .order_by(AgentSkillLink.sort_order)
        )
        skill_result = await self.db.execute(skill_stmt)
        skill_rows = skill_result.all()
        skill_ids = [str(r[0]) for r in skill_rows]
        skills = [SkillBrief(id=str(r[0]), name=r[1] or "unknown", description=r[2]) for r in skill_rows]

        # Check favorite status
        is_favorited = False
        if user_id:
            fav_stmt = select(AgentFavorite.id).where(
                AgentFavorite.agent_id == agent_id,
                AgentFavorite.user_id == user_id,
            )
            fav_result = await self.db.execute(fav_stmt)
            is_favorited = fav_result.scalar_one_or_none() is not None

        tags = json.loads(agent.tags) if agent.tags else []
        return AgentDetail(
            id=str(agent.id),
            name=agent.name,
            description=agent.description,
            system_prompt=agent.system_prompt,
            category=agent.category,
            tags=tags,
            default_llm_model=agent.default_llm_model,
            config_json=agent.config_json,
            usage_instructions=agent.usage_instructions,
            is_enabled=agent.is_enabled,
            usage_count=agent.usage_count,
            created_by=agent.created_by,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            skill_ids=skill_ids,
            skills=skills,
            is_favorited=is_favorited,
        )

    async def create_agent(self, data: AgentCreate, created_by: str | None = None) -> str:
        agent_id = uuid4()
        agent = StoredAgent(
            id=agent_id,
            name=data.name,
            description=data.description,
            system_prompt=data.system_prompt,
            category=data.category,
            tags=json.dumps(data.tags) if data.tags else None,
            default_llm_model=data.default_llm_model,
            config_json=data.config_json,
            usage_instructions=data.usage_instructions,
            is_enabled=True,
            usage_count=0,
            created_by=created_by,
        )
        self.db.add(agent)

        # Link skills
        for i, skill_id in enumerate(data.skill_ids):
            link = AgentSkillLink(id=uuid4(), agent_id=agent_id, skill_id=skill_id, sort_order=i)
            self.db.add(link)

        await self.db.commit()
        return str(agent_id)

    async def update_agent(self, agent_id: str, data: AgentUpdate) -> bool:
        values = {}
        if data.name is not None:
            values['name'] = data.name
        if data.description is not None:
            values['description'] = data.description
        if data.system_prompt is not None:
            values['system_prompt'] = data.system_prompt
        if data.category is not None:
            values['category'] = data.category
        if data.tags is not None:
            values['tags'] = json.dumps(data.tags)
        if data.default_llm_model is not None:
            values['default_llm_model'] = data.default_llm_model
        if data.config_json is not None:
            values['config_json'] = data.config_json
        if data.is_enabled is not None:
            values['is_enabled'] = data.is_enabled

        if not values:
            return True

        values['updated_at'] = datetime.now(timezone.utc)
        stmt = update(StoredAgent).where(StoredAgent.id == agent_id).values(**values)
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def delete_agent(self, agent_id: str) -> bool:
        stmt = delete(StoredAgent).where(StoredAgent.id == agent_id)
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def set_agent_skills(self, agent_id: str, skill_ids: list[str]) -> None:
        await self.db.execute(delete(AgentSkillLink).where(AgentSkillLink.agent_id == agent_id))
        for i, skill_id in enumerate(skill_ids):
            link = AgentSkillLink(id=uuid4(), agent_id=agent_id, skill_id=skill_id, sort_order=i)
            self.db.add(link)
        await self.db.commit()

    async def toggle_favorite(self, agent_id: str, user_id: str) -> bool:
        """Toggle favorite. Returns True if favorited, False if unfavorited."""
        stmt = select(AgentFavorite).where(
            AgentFavorite.agent_id == agent_id,
            AgentFavorite.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            await self.db.delete(existing)
            await self.db.commit()
            return False
        else:
            fav = AgentFavorite(id=uuid4(), agent_id=agent_id, user_id=user_id)
            self.db.add(fav)
            await self.db.commit()
            return True

    async def list_favorites(self, user_id: str) -> list[AgentInfo]:
        stmt = (
            select(StoredAgent)
            .join(AgentFavorite, AgentFavorite.agent_id == StoredAgent.id)
            .where(AgentFavorite.user_id == user_id)
            .order_by(AgentFavorite.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return [self._to_info(r) for r in result.scalars().all()]

    async def increment_usage(self, agent_id: str) -> None:
        stmt = update(StoredAgent).where(StoredAgent.id == agent_id).values(
            usage_count=StoredAgent.usage_count + 1,
            updated_at=datetime.now(timezone.utc),
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def list_categories(self) -> list[str]:
        stmt = select(StoredAgent.category).where(StoredAgent.category.isnot(None)).distinct()
        result = await self.db.execute(stmt)
        return [r for r in result.scalars().all() if r]

    async def list_creators(self) -> list[str]:
        stmt = select(StoredAgent.created_by).where(StoredAgent.created_by.isnot(None)).distinct()
        result = await self.db.execute(stmt)
        return [r for r in result.scalars().all() if r]

    def _to_info(self, agent: StoredAgent) -> AgentInfo:
        tags = json.loads(agent.tags) if agent.tags else []
        return AgentInfo(
            id=str(agent.id),
            name=agent.name,
            description=agent.description,
            category=agent.category,
            tags=tags,
            is_enabled=agent.is_enabled,
            usage_count=agent.usage_count,
            created_by=agent.created_by,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
        )
