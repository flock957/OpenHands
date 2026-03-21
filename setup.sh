#!/bin/bash
# HiClaw 内网部署脚本
# 使用方式: bash setup.sh
# 前提: 目标机器有 sudo 权限，有内网代理可访问外网
set -e

echo "=========================================="
echo "  HiClaw 内网部署"
echo "=========================================="

# ─── 1. 系统依赖 ───────────────────────────
echo ""
echo "[1/6] 安装系统依赖..."

if ! command -v docker &>/dev/null; then
    echo "  安装 Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /tmp/docker.asc
    sudo mv /tmp/docker.asc /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    sudo chmod 666 /var/run/docker.sock
    echo "  Docker 安装完成"
else
    echo "  Docker 已安装: $(docker --version)"
fi

if ! command -v python3.12 &>/dev/null; then
    echo "  安装 Python 3.12..."
    sudo apt-get update
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
    sudo apt-get update
    sudo apt-get install -y python3.12 python3.12-dev python3.12-venv || \
    sudo apt-get install -y python3 python3-dev python3-venv
    echo "  Python 安装完成"
else
    echo "  Python 3.12 已安装"
fi

sudo apt-get install -y build-essential curl git tmux netcat-openbsd 2>/dev/null || true

# ─── 2. Poetry ─────────────────────────────
echo ""
echo "[2/6] 安装 Poetry..."
if ! command -v poetry &>/dev/null; then
    curl -sSL https://install.python-poetry.org | python3 -
    export PATH="$HOME/.local/bin:$PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    echo "  Poetry 安装完成"
else
    echo "  Poetry 已安装: $(poetry --version)"
fi

# ─── 3. Node.js ────────────────────────────
echo ""
echo "[3/6] 安装 Node.js 22..."
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d v) -lt 22 ]]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    echo "  Node.js 22 安装完成"
else
    echo "  Node.js 已安装: $(node --version)"
fi

# ─── 4. 构建项目 ───────────────────────────
echo ""
echo "[4/6] 构建项目 (make build)..."
export PATH="$HOME/.local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
make build

# ─── 5. 拉取 agent-server 镜像 ────────────
echo ""
echo "[5/6] 拉取 agent-server 镜像..."
AGENT_IMAGE="ghcr.io/openhands/agent-server:1.14.0-python"
if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$AGENT_IMAGE"; then
    echo "  镜像已存在: $AGENT_IMAGE"
else
    echo "  拉取中 (约 4.6GB, 请耐心等待)..."
    docker pull $AGENT_IMAGE
    echo "  拉取完成"
fi

# ─── 6. 配置 ───────────────────────────────
echo ""
echo "[6/6] 初始化配置..."
mkdir -p ~/.openhands

if [ ! -f ~/.openhands/settings.json ]; then
    echo "  请输入 LLM 配置 (直接回车跳过, 后续可在 Web 页面设置):"
    read -p "  模型名称 (e.g. openai/qwen-max): " LLM_MODEL
    read -p "  API Key: " LLM_KEY
    read -p "  Base URL (非 OpenAI 需要): " LLM_URL

    cat > ~/.openhands/settings.json << EOF
{
  "llm_model": "${LLM_MODEL:-openai/qwen-max}",
  "llm_api_key": "${LLM_KEY}",
  "llm_base_url": "${LLM_URL}"
}
EOF
    echo "  配置已保存到 ~/.openhands/settings.json"
else
    echo "  配置已存在, 跳过"
fi

# ─── 完成 ──────────────────────────────────
echo ""
echo "=========================================="
echo "  部署完成!"
echo ""
echo "  启动命令:"
echo "    BACKEND_HOST=0.0.0.0 FRONTEND_HOST=0.0.0.0 make run"
echo ""
echo "  访问地址: http://$(hostname -I | awk '{print $1}'):3001"
echo "=========================================="
