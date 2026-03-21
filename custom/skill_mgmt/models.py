"""Skill management database models and Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, func
from sqlalchemy import UUID as SQLUUID

from openhands.app_server.utils.sql_utils import Base, UtcDateTime


# ─── SQLAlchemy ORM Models ───────────────────────────────────────


class StoredSkill(Base):  # type: ignore
    __tablename__ = 'managed_skill'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True, index=True)
    skill_type = Column(String, nullable=False, server_default='knowledge')
    triggers = Column(Text, nullable=True)  # JSON string: ["trigger1", "trigger2"]
    tags = Column(Text, nullable=True)  # JSON string: ["tag1", "tag2"]
    is_global = Column(Boolean, nullable=False, server_default='1')
    is_active = Column(Boolean, nullable=False, server_default='1')
    created_by = Column(String, nullable=True)
    current_version = Column(Integer, nullable=False, server_default='1')
    created_at = Column(UtcDateTime, server_default=func.now(), index=True)
    updated_at = Column(UtcDateTime, server_default=func.now())


class StoredSkillVersion(Base):  # type: ignore
    __tablename__ = 'skill_version'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    skill_id = Column(SQLUUID, ForeignKey('managed_skill.id', ondelete='CASCADE'), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)  # Markdown content of the skill
    changelog = Column(Text, nullable=True)
    performance_notes = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, server_default='1')
    created_by = Column(String, nullable=True)
    created_at = Column(UtcDateTime, server_default=func.now())


class StoredSkillScript(Base):  # type: ignore
    __tablename__ = 'skill_script'

    id = Column(SQLUUID, primary_key=True, default=uuid4)
    skill_id = Column(SQLUUID, ForeignKey('managed_skill.id', ondelete='CASCADE'), nullable=False, index=True)
    filename = Column(String, nullable=False)
    language = Column(String, nullable=True)  # python, bash, javascript, etc.
    content = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(UtcDateTime, server_default=func.now())
    updated_at = Column(UtcDateTime, server_default=func.now())


# ─── Pydantic API Schemas ────────────────────────────────────────


class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    skill_type: str = 'knowledge'
    triggers: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    is_global: bool = True
    content: str  # Markdown content (first version)


class SkillUpdate(BaseModel):
    description: str | None = None
    category: str | None = None
    triggers: list[str] | None = None
    tags: list[str] | None = None
    is_global: bool | None = None
    is_active: bool | None = None


class SkillVersionCreate(BaseModel):
    content: str
    changelog: str | None = None
    performance_notes: str | None = None


class ScriptCreate(BaseModel):
    filename: str
    language: str | None = None
    content: str
    description: str | None = None


class ScriptUpdate(BaseModel):
    filename: str | None = None
    language: str | None = None
    content: str | None = None
    description: str | None = None


class SkillInfo(BaseModel):
    id: str
    name: str
    description: str | None
    category: str | None
    skill_type: str
    triggers: list[str]
    tags: list[str]
    is_global: bool
    is_active: bool
    created_by: str | None
    current_version: int
    created_at: datetime
    updated_at: datetime


class SkillVersionInfo(BaseModel):
    id: str
    skill_id: str
    version: int
    content: str
    changelog: str | None
    performance_notes: str | None
    is_current: bool
    created_by: str | None
    created_at: datetime


class ScriptInfo(BaseModel):
    id: str
    skill_id: str
    filename: str
    language: str | None
    content: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class SkillDetail(SkillInfo):
    """Full skill detail including current version content and scripts."""
    content: str  # Current version content
    versions: list[SkillVersionInfo] = Field(default_factory=list)
    scripts: list[ScriptInfo] = Field(default_factory=list)
