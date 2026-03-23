"""Agent management API router."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from custom.agent_mgmt.db import get_agent_db
from custom.agent_mgmt.models import AgentCreate, AgentUpdate
from custom.agent_mgmt.service import AgentService

router = APIRouter(prefix='/agents', tags=['Agents'])


@router.get('')
async def list_agents(
    search: str | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    is_enabled: bool | None = Query(None),
    created_by: str | None = Query(None),
    sort_by: str = Query('created_at'),
    sort_order: str = Query('desc'),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        agents = await svc.list_agents(
            search=search, category=category, tag=tag, is_enabled=is_enabled,
            created_by=created_by, sort_by=sort_by, sort_order=sort_order,
            limit=limit, offset=offset,
        )
        total = await svc.count_agents(search=search, category=category, is_enabled=is_enabled)
        return {'agents': [a.model_dump() for a in agents], 'total': total}
    finally:
        await db.close()


@router.post('')
async def create_agent(data: AgentCreate):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        agent_id = await svc.create_agent(data)
        return {'id': agent_id}
    finally:
        await db.close()


@router.get('/categories')
async def list_categories():
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        return await svc.list_categories()
    finally:
        await db.close()


@router.get('/creators')
async def list_creators():
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        return await svc.list_creators()
    finally:
        await db.close()


@router.get('/favorites')
async def list_favorites(user_id: str = Query('default')):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        agents = await svc.list_favorites(user_id)
        return {'agents': [a.model_dump() for a in agents]}
    finally:
        await db.close()


@router.get('/{agent_id}')
async def get_agent(agent_id: str, user_id: str = Query('default')):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        agent = await svc.get_agent(agent_id, user_id=user_id)
        if not agent:
            raise HTTPException(status_code=404, detail='Agent not found')
        return agent.model_dump()
    finally:
        await db.close()


@router.patch('/{agent_id}')
async def update_agent(agent_id: str, data: AgentUpdate):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        ok = await svc.update_agent(agent_id, data)
        if not ok:
            raise HTTPException(status_code=404, detail='Agent not found')
        return {'status': 'updated'}
    finally:
        await db.close()


@router.delete('/{agent_id}')
async def delete_agent(agent_id: str):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        ok = await svc.delete_agent(agent_id)
        if not ok:
            raise HTTPException(status_code=404, detail='Agent not found')
        return {'status': 'deleted'}
    finally:
        await db.close()


@router.put('/{agent_id}/skills')
async def set_agent_skills(agent_id: str, skill_ids: list[str]):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        await svc.set_agent_skills(agent_id, skill_ids)
        return {'status': 'updated'}
    finally:
        await db.close()


@router.post('/{agent_id}/favorite')
async def toggle_favorite(agent_id: str, user_id: str = Query('default')):
    db = await get_agent_db()
    try:
        svc = AgentService(db)
        is_favorited = await svc.toggle_favorite(agent_id, user_id)
        return {'is_favorited': is_favorited}
    finally:
        await db.close()
