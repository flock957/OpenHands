"""Register performance analysis skills into the skill management database."""

import asyncio
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

import frontmatter


async def register_perf_skills():
    from custom.skill_mgmt.db import get_skill_db
    from custom.skill_mgmt.service import SkillService
    from custom.skill_mgmt.models import SkillCreate

    db = await get_skill_db()
    svc = SkillService(db)

    skill_dir = os.path.dirname(__file__)

    for fname in sorted(os.listdir(skill_dir)):
        if not fname.endswith('.md'):
            continue

        filepath = os.path.join(skill_dir, fname)
        with open(filepath) as f:
            post = frontmatter.load(f)

        meta = post.metadata or {}
        name = meta.get('name', fname.replace('.md', ''))
        triggers = meta.get('triggers', [])
        content = post.content

        # Check if already exists
        existing = await svc.list_skills(search=name, limit=1)
        if existing and any(s.name == name for s in existing):
            print(f"  SKIP: {name} (already exists)")
            continue

        skill_data = SkillCreate(
            name=name,
            description=f"Performance analysis skill: {name}",
            category="performance",
            skill_type=meta.get('type', 'knowledge'),
            triggers=triggers,
            tags=["perf", "trace", "perfetto"],
            is_global=True,
            content=content,
            version="1.0.0",
        )

        result = await svc.create_skill(skill_data)
        print(f"  CREATED: {name} (id={result.id})")

    print("\nDone! All performance skills registered.")


if __name__ == '__main__':
    asyncio.run(register_perf_skills())
