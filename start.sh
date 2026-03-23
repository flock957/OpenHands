#!/bin/bash
#
# HiClaw (OpenHands) 启动脚本
#
# 功能：
# 1. 挂载会话数据目录，确保会话历史持久化（容器重建不丢数据）
# 2. 自动创建必要目录并设置权限
# 3. 支持前台/后台运行
#
# 用法：
#   ./start.sh          # 前台运行（Ctrl+C 停止）
#   ./start.sh -d       # 后台运行（日志写入 /tmp/openhands.log）
#   ./start.sh stop     # 停止后台运行的实例
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${OH_PORT:-3000}"
LOG_FILE="/tmp/openhands.log"
PERSISTENCE_DIR="${OH_PERSISTENCE_DIR:-$HOME/.openhands}"
SANDBOX_DATA_DIR="$PERSISTENCE_DIR/sandbox-data"

# --- 持久化会话数据 ---
# 将容器内的 /workspace/conversations 挂载到宿主机
# 这样即使容器被删除重建，会话历史仍然保留
mkdir -p "$SANDBOX_DATA_DIR"
# 容器内用户 uid=10001 (openhands)
if [ "$(stat -c %u "$SANDBOX_DATA_DIR" 2>/dev/null)" != "10001" ]; then
    sudo chown -R 10001:10001 "$SANDBOX_DATA_DIR" 2>/dev/null || true
fi
export SANDBOX_VOLUMES="$SANDBOX_DATA_DIR:/workspace/conversations:rw"

# --- 网络模式 ---
# 内网环境 host.docker.internal 可能不通，使用 host 网络模式
# 容器直接共享宿主机网络，无需 host.docker.internal
export AGENT_SERVER_USE_HOST_NETWORK="${AGENT_SERVER_USE_HOST_NETWORK:-true}"

# --- 确保 Docker 可用 ---
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# --- 命令处理 ---
case "${1:-}" in
    stop)
        PID=$(pgrep -f "uvicorn openhands.server.listen.*$PORT" 2>/dev/null || true)
        if [ -n "$PID" ]; then
            kill "$PID"
            echo "Stopped OpenHands (PID $PID)"
        else
            echo "OpenHands is not running on port $PORT"
        fi
        exit 0
        ;;
    -d|--daemon)
        PID=$(pgrep -f "uvicorn openhands.server.listen.*$PORT" 2>/dev/null || true)
        if [ -n "$PID" ]; then
            echo "OpenHands is already running (PID $PID) on port $PORT"
            exit 1
        fi
        echo "Starting OpenHands in background on port $PORT..."
        echo "Log: $LOG_FILE"
        nohup poetry run uvicorn openhands.server.listen:app \
            --host 0.0.0.0 --port "$PORT" \
            > "$LOG_FILE" 2>&1 &
        echo "PID: $!"
        echo "Waiting for startup..."
        for i in $(seq 1 30); do
            if ss -tlnp | grep -q ":$PORT "; then
                echo "OpenHands is running at http://0.0.0.0:$PORT"
                exit 0
            fi
            sleep 1
        done
        echo "WARNING: Server did not start within 30 seconds. Check $LOG_FILE"
        exit 1
        ;;
    *)
        echo "Starting OpenHands on port $PORT..."
        echo "SANDBOX_VOLUMES=$SANDBOX_VOLUMES"
        exec poetry run uvicorn openhands.server.listen:app \
            --host 0.0.0.0 --port "$PORT"
        ;;
esac
