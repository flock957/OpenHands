# HiClaw App Image — code only, builds on hiclaw-base
# Build: docker build -t hiclaw:latest -f containers/app/Dockerfile.app .
# Requires: hiclaw-base:latest

FROM hiclaw-base:latest AS base

# --- Frontend build (uses pre-installed node_modules from base) ---
FROM node:25.2-trixie-slim AS frontend-builder
WORKDIR /app
COPY --from=base /app/frontend-deps/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# --- Final image ---
FROM base

USER openhands

# Backend code
COPY --chown=openhands:openhands --chmod=770 ./skills ./skills
COPY --chown=openhands:openhands --chmod=770 ./openhands ./openhands
COPY --chown=openhands:openhands --chmod=777 ./openhands/runtime/plugins ./openhands/runtime/plugins
COPY --chown=openhands:openhands pyproject.toml poetry.lock README.md MANIFEST.in LICENSE ./

# Custom code
COPY --chown=openhands:openhands --chmod=770 ./custom ./custom

RUN python openhands/core/download.py
RUN find /app \! -group openhands -exec chgrp openhands {} +

# Frontend build output
COPY --chown=openhands:openhands --chmod=770 --from=frontend-builder /app/build ./frontend/build
COPY --chown=openhands:openhands --chmod=770 ./containers/app/entrypoint.sh /app/entrypoint.sh

USER root
WORKDIR /app

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "openhands.server.listen:app", "--host", "0.0.0.0", "--port", "3000"]
