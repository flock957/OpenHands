"""Conversation extensions — model hot-swap in current conversation."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

_logger = logging.getLogger(__name__)

router = APIRouter(prefix='/conversations', tags=['Conversation Extensions'])


class ModelSwitchRequest(BaseModel):
    llm_model: str
    llm_api_key: str | None = None
    llm_base_url: str | None = None


class ModelSwitchResponse(BaseModel):
    status: str
    message: str


@router.post('/{conversation_id}/switch-model', response_model=ModelSwitchResponse)
async def switch_model(conversation_id: str, req: ModelSwitchRequest):
    """Hot-swap LLM model in the current conversation's container.

    1. docker commit → snapshot current container (all files preserved)
    2. Stop old container
    3. Start new container from snapshot with new LLM env vars (same name)
    4. Same conversation, same sandbox_id, same files, new model
    """
    import docker

    client = docker.from_env()

    try:
        # --- Find sandbox_id for this conversation ---
        old_sandbox_id = None

        try:
            from custom.skill_mgmt.db import get_skill_db
            from sqlalchemy import text

            db = await get_skill_db()
            # Try both UUID formats
            cid = conversation_id.replace('-', '')
            cid_dash = f'{cid[:8]}-{cid[8:12]}-{cid[12:16]}-{cid[16:20]}-{cid[20:]}' if len(cid) == 32 else conversation_id

            result = await db.execute(
                text("SELECT sandbox_id FROM conversation_metadata WHERE conversation_id IN (:a, :b)"),
                {'a': cid_dash, 'b': cid},
            )
            row = result.fetchone()
            if row and row[0]:
                old_sandbox_id = row[0]
        except Exception as e:
            _logger.warning(f'DB lookup failed: {e}')

        # Fallback: use the first running container
        if not old_sandbox_id:
            running = client.containers.list()
            agent_containers = [c for c in running if (c.name or '').startswith('oh-agent-server-')]
            if agent_containers:
                old_sandbox_id = str(agent_containers[0].name)
                _logger.info(f'Fallback: using running container {old_sandbox_id}')
            else:
                raise HTTPException(status_code=404, detail='没有找到运行中的容器')

        assert old_sandbox_id is not None
        _logger.info(f'Switching model for sandbox {old_sandbox_id}')

        # --- Get old container ---
        try:
            old_container = client.containers.get(old_sandbox_id)
        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f'容器 {old_sandbox_id} 不存在')

        # --- Snapshot filesystem ---
        snapshot_tag = f'hiclaw-snapshot:{old_sandbox_id[:20]}'
        _logger.info(f'Committing container → {snapshot_tag}')
        old_container.commit(repository='hiclaw-snapshot', tag=old_sandbox_id[:20])

        # --- Collect old container config ---
        attrs = old_container.attrs
        old_env = attrs['Config'].get('Env', [])
        old_cmd = attrs['Config'].get('Cmd')
        old_workdir = attrs['Config'].get('WorkingDir', '/workspace/project')
        old_labels = attrs['Config'].get('Labels', {})
        net_mode = attrs['HostConfig'].get('NetworkMode', '')
        extra_hosts = attrs['HostConfig'].get('ExtraHosts')

        # Build port bindings for bridge mode
        port_bindings = {}
        if net_mode != 'host':
            ports_config = attrs.get('NetworkSettings', {}).get('Ports', {})
            for cp, bindings in (ports_config or {}).items():
                if bindings:
                    port_bindings[cp] = [{'HostPort': b['HostPort']} for b in bindings]

        # --- Build new env: swap LLM vars ---
        new_env = [e for e in old_env if not e.startswith(('LLM_MODEL=', 'LLM_API_KEY=', 'LLM_BASE_URL='))]
        new_env.append(f'LLM_MODEL={req.llm_model}')
        if req.llm_api_key:
            new_env.append(f'LLM_API_KEY={req.llm_api_key}')
        if req.llm_base_url:
            new_env.append(f'LLM_BASE_URL={req.llm_base_url}')

        # --- Stop old container ---
        _logger.info(f'Stopping {old_sandbox_id}')
        old_container.stop(timeout=5)
        old_container.remove(force=True)

        # --- Start new container from snapshot (same name = same sandbox_id) ---
        _logger.info(f'Starting new container {old_sandbox_id}')
        client.containers.run(  # type: ignore[call-overload]
            image=snapshot_tag,
            command=old_cmd,
            name=old_sandbox_id,
            environment=new_env,
            working_dir=str(old_workdir),
            labels=old_labels,
            network_mode=net_mode if net_mode == 'host' else None,
            ports=port_bindings if net_mode != 'host' else None,
            extra_hosts=extra_hosts,
            detach=True,
            remove=False,
        )
        _logger.info(f'Container {old_sandbox_id} restarted with new model')

        # --- Update host settings ---
        persistence_dir = os.environ.get('OH_PERSISTENCE_DIR', str(Path.home() / '.openhands'))
        settings_path = Path(persistence_dir) / 'settings.json'
        settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
        old_model = settings.get('llm_model', 'unknown')
        settings['llm_model'] = req.llm_model
        if req.llm_api_key:
            settings['llm_api_key'] = req.llm_api_key
        if req.llm_base_url:
            settings['llm_base_url'] = req.llm_base_url
        settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2))

        return ModelSwitchResponse(
            status='ok',
            message=f'模型已从 {old_model} 切换为 {req.llm_model}，容器已重启，工作文件保留。刷新页面发消息即可继续。',
        )

    except HTTPException:
        raise
    except Exception as e:
        _logger.error(f'Model switch failed: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail=f'模型切换失败: {str(e)}')
