"""Agent and Task management database models and Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy import UUID as SQLUUID

from openhands.app_server.utils.sql_utils import Base, UtcDateTime


# ─── SQLAlchemy ORM Models ───────────────────────────────────────


class StoredAgent(Base):  # type: ignore
    __tablename__ = 'managed_agent'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    category = Column(String, nullable=True, index=True)
    tags = Column(Text, nullable=True)  # JSON string: ["tag1", "tag2"]
    default_llm_model = Column(String, nullable=True)
    config_json = Column(Text, nullable=True)  # JSON string: extra settings
    is_enabled = Column(Boolean, nullable=False, server_default='1', index=True)
    usage_count = Column(Integer, nullable=False, server_default='0')
    created_by = Column(String, nullable=True)
    created_at = Column(UtcDateTime, server_default=func.now(), index=True)
    updated_at = Column(UtcDateTime, server_default=func.now())


class AgentSkillLink(Base):  # type: ignore
    __tablename__ = 'agent_skill'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    agent_id = Column(SQLUUID, ForeignKey('managed_agent.id', ondelete='CASCADE'), nullable=False, index=True)
    skill_id = Column(SQLUUID, ForeignKey('managed_skill.id', ondelete='CASCADE'), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, server_default='0')


class AgentFavorite(Base):  # type: ignore
    __tablename__ = 'agent_favorite'
    __table_args__ = (UniqueConstraint('agent_id', 'user_id', name='uq_agent_favorite'),)

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    agent_id = Column(SQLUUID, ForeignKey('managed_agent.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(UtcDateTime, server_default=func.now())


class TaskStatus(str, Enum):
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'
    CANCELLED = 'cancelled'


class StoredTask(Base):  # type: ignore
    __tablename__ = 'agent_task'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    agent_id = Column(SQLUUID, ForeignKey('managed_agent.id', ondelete='SET NULL'), nullable=True, index=True)
    conversation_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=True)
    status = Column(String, nullable=False, server_default='pending', index=True)
    created_by = Column(String, nullable=True, index=True)
    started_at = Column(UtcDateTime, nullable=True)
    completed_at = Column(UtcDateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(UtcDateTime, server_default=func.now(), index=True)
    updated_at = Column(UtcDateTime, server_default=func.now())


# ─── Pydantic API Schemas ────────────────────────────────────────


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    system_prompt: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    default_llm_model: str | None = None
    config_json: str | None = None
    skill_ids: list[str] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    default_llm_model: str | None = None
    config_json: str | None = None
    is_enabled: bool | None = None


class AgentInfo(BaseModel):
    id: str
    name: str
    description: str | None
    category: str | None
    tags: list[str]
    is_enabled: bool
    usage_count: int
    created_by: str | None
    created_at: datetime
    updated_at: datetime


class AgentDetail(AgentInfo):
    system_prompt: str | None
    default_llm_model: str | None
    config_json: str | None
    skill_ids: list[str] = Field(default_factory=list)
    is_favorited: bool = False


class TaskCreate(BaseModel):
    agent_id: str
    name: str | None = None
    initial_message: str | None = None


class TaskUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


class TaskInfo(BaseModel):
    id: str
    agent_id: str | None
    agent_name: str | None = None
    conversation_id: str | None
    name: str | None
    status: str
    created_by: str | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
