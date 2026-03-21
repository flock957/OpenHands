"""Skill management API routes + conversation model hot-swap."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from custom.skill_mgmt.models import (
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
from custom.skill_mgmt.service import SkillService
from custom.skill_mgmt.db import get_skill_db

router = APIRouter(prefix='/skills', tags=['Skills'])


async def _get_service() -> SkillService:
    db = await get_skill_db()
    return SkillService(db)


# ─── Skill CRUD ──────────────────────────────────────────────────


@router.get('', response_model=dict)
async def list_skills(
    search: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List all skills with optional search and filters."""
    svc = await _get_service()
    skills = await svc.list_skills(search=search, category=category, tag=tag, is_active=is_active, limit=limit, offset=offset)
    total = await svc.count_skills(search=search, category=category, is_active=is_active)
    return {'results': skills, 'total': total}


@router.post('', response_model=SkillDetail, status_code=201)
async def create_skill(data: SkillCreate):
    """Create a new skill with initial version."""
    svc = await _get_service()
    try:
        return await svc.create_skill(data)
    except Exception as e:
        if 'UNIQUE' in str(e).upper():
            raise HTTPException(status_code=409, detail=f'Skill with name "{data.name}" already exists')
        raise


@router.get('/categories', response_model=list[str])
async def list_categories():
    """List all skill categories."""
    svc = await _get_service()
    return await svc.list_categories()


@router.get('/{skill_id}', response_model=SkillDetail)
async def get_skill(skill_id: str):
    """Get full skill detail including versions and scripts."""
    svc = await _get_service()
    skill = await svc.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail='Skill not found')
    return skill


@router.patch('/{skill_id}', response_model=SkillDetail)
async def update_skill(skill_id: str, data: SkillUpdate):
    """Update skill metadata."""
    svc = await _get_service()
    skill = await svc.update_skill(skill_id, data)
    if not skill:
        raise HTTPException(status_code=404, detail='Skill not found')
    return skill


@router.delete('/{skill_id}', status_code=204)
async def delete_skill(skill_id: str):
    """Delete a skill and all its versions and scripts."""
    svc = await _get_service()
    if not await svc.delete_skill(skill_id):
        raise HTTPException(status_code=404, detail='Skill not found')


# ─── File Upload ─────────────────────────────────────────────────


@router.post('/upload', response_model=SkillDetail, status_code=201)
async def upload_skill_files(
    name: str = Form(...),
    description: str = Form(default=''),
    category: str = Form(default=''),
    triggers: str = Form(default=''),  # comma-separated
    tags: str = Form(default=''),  # comma-separated
    skill_file: UploadFile = File(...),
    script_files: list[UploadFile] = File(default=[]),
):
    """Upload a skill from .md file with optional script files (.py, .sh, etc.)."""
    svc = await _get_service()

    # Read skill content
    content = (await skill_file.read()).decode('utf-8')

    trigger_list = [t.strip() for t in triggers.split(',') if t.strip()] if triggers else []
    tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []

    skill_data = SkillCreate(
        name=name,
        description=description or None,
        category=category or None,
        triggers=trigger_list,
        tags=tag_list,
        content=content,
    )

    try:
        skill = await svc.create_skill(skill_data)
    except Exception as e:
        if 'UNIQUE' in str(e).upper():
            raise HTTPException(status_code=409, detail=f'Skill with name "{name}" already exists')
        raise

    # Upload script files
    for sf in script_files:
        if sf.filename:
            script_content = (await sf.read()).decode('utf-8')
            await svc.add_script(
                skill.id,
                ScriptCreate(
                    filename=sf.filename,
                    content=script_content,
                ),
            )

    # Re-fetch to include scripts
    return await svc.get_skill(skill.id)


# ─── Version Management ─────────────────────────────────────────


@router.post('/{skill_id}/versions', response_model=SkillVersionInfo, status_code=201)
async def create_version(skill_id: str, data: SkillVersionCreate):
    """Create a new version of a skill."""
    svc = await _get_service()
    version = await svc.create_version(skill_id, data)
    if not version:
        raise HTTPException(status_code=404, detail='Skill not found')
    return version


@router.post('/{skill_id}/versions/{version_id}/rollback', response_model=SkillDetail)
async def rollback_version(skill_id: str, version_id: str):
    """Rollback skill to a specific version."""
    svc = await _get_service()
    skill = await svc.rollback_version(skill_id, version_id)
    if not skill:
        raise HTTPException(status_code=404, detail='Skill or version not found')
    return skill


# ─── Script Management ──────────────────────────────────────────


@router.post('/{skill_id}/scripts', response_model=ScriptInfo, status_code=201)
async def add_script(skill_id: str, data: ScriptCreate):
    """Add a script file to a skill."""
    svc = await _get_service()
    script = await svc.add_script(skill_id, data)
    if not script:
        raise HTTPException(status_code=404, detail='Skill not found')
    return script


@router.post('/{skill_id}/scripts/upload', response_model=ScriptInfo, status_code=201)
async def upload_script(skill_id: str, file: UploadFile = File(...), description: str = Form(default='')):
    """Upload a script file to a skill."""
    svc = await _get_service()
    content = (await file.read()).decode('utf-8')
    script = await svc.add_script(
        skill_id,
        ScriptCreate(
            filename=file.filename or 'unnamed',
            content=content,
            description=description or None,
        ),
    )
    if not script:
        raise HTTPException(status_code=404, detail='Skill not found')
    return script


@router.patch('/scripts/{script_id}', response_model=ScriptInfo)
async def update_script(script_id: str, data: ScriptUpdate):
    """Update a script."""
    svc = await _get_service()
    script = await svc.update_script(script_id, data)
    if not script:
        raise HTTPException(status_code=404, detail='Script not found')
    return script


@router.delete('/scripts/{script_id}', status_code=204)
async def delete_script(script_id: str):
    """Delete a script."""
    svc = await _get_service()
    if not await svc.delete_script(script_id):
        raise HTTPException(status_code=404, detail='Script not found')
