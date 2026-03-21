# OpenHands 部署运维手册

> 维护人: gyz | 最后更新: 2026-03-20
> 本文档记录部署过程中遇到的问题、踩坑经验和正确配置方式。

---

## 1. 环境要求

| 项目 | 要求 |
|------|------|
| OS | Ubuntu 24.04 |
| Python | 3.12 |
| Node.js | >= 22（推荐 nvm 安装） |
| Poetry | >= 2.x |
| Docker | 最新版 |
| 内存 | >= 8GB（建议 16GB） |
| 磁盘 | >= 30GB |

## 2. 安装步骤

```bash
# 1. 安装 Poetry
curl -sSL https://install.python-poetry.org | python3 -

# 2. 安装 nvm + Node.js 22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22

# 3. 安装 Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /tmp/docker.asc
sudo mv /tmp/docker.asc /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Docker 权限（重要！否则 OpenHands 启动后报 PermissionError）
sudo usermod -aG docker $USER
sudo chmod 666 /var/run/docker.sock  # 立即生效，不用重新登录

# 5. 构建项目
cd OpenHands
make build

# 6. 配置 LLM
cat > ~/.openhands/settings.json << 'EOF'
{
  "llm_model": "openai/qwen-plus-2025-07-28",
  "llm_api_key": "your-api-key",
  "llm_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
EOF

# 7. 启动
BACKEND_HOST=0.0.0.0 FRONTEND_HOST=0.0.0.0 make run
```

## 3. 端口架构

```
浏览器
  │
  ├── :3001  前端 React (Vite dev server)
  ├── :3000  后端 FastAPI (App Server)
  └── :随机  VSCode (容器内 OpenVSCode Server，bridge 模式下随机端口)

宿主机
  │
  ├── App Server (:3000)  ── 管理层：会话、用户、Skill、沙箱调度
  ├── Frontend (:3001)    ── 静态页面 + JS 调用 3000 API
  │
  └── Docker 容器 (Agent Server)  ── 每个会话一个容器
       ├── :8000 (映射到随机端口)  Agent HTTP API
       ├── :8001 (映射到随机端口)  OpenVSCode Server
       ├── :8011 (映射到随机端口)  Worker 1
       └── :8012 (映射到随机端口)  Worker 2
```

### 交互流程

1. **用户发消息**: 浏览器 → :3001 前端 → :3000 App Server → :随机端口 Agent Server → 调用 LLM
2. **Code 标签**: 浏览器 iframe 直连 Agent Server 的 VSCode 端口（不经过 App Server）
3. **容器回调宿主机**: 容器内用 `host.docker.internal:3000` 访问 App Server（webhook、MCP）

## 4. 踩坑记录

### 4.1 Docker 权限问题（500 错误）

**症状**: 前端访问 Recent Conversations 报 500 错误

**原因**: `usermod -aG docker` 后没有重新登录，当前 session 没有 docker 组权限。App Server 无法连接 Docker socket。

**日志关键字**:
```
docker.errors.DockerException: Error while fetching server API version: PermissionError(13, 'Permission denied')
```

**解决**:
```bash
# 方法1: 重新登录
# 方法2: 临时修改 socket 权限（立即生效）
sudo chmod 666 /var/run/docker.sock
```

### 4.2 sudo 权限配置

**症状**: 用户无法使用 sudo

**原因**: 用户不在 sudo 组，或加入 sudo 组后没有重新登录

**解决**:
```bash
# 用 root 或已有 sudo 权限的用户执行
sudo usermod -aG sudo 用户名
echo "用户名 ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/用户名

# 必须重新登录才能生效
```

### 4.3 Docker 网络模式选择

**Bridge 模式（默认，推荐）**:
- 每个容器端口随机映射到宿主机
- 支持多容器同时运行（默认最多 5 个）
- 容器内用 `host.docker.internal` 访问宿主机
- VSCode 端口是随机的（如 59593）

```bash
# 默认就是 bridge 模式，直接启动即可
BACKEND_HOST=0.0.0.0 FRONTEND_HOST=0.0.0.0 make run
```

**Host 模式**:
- 容器共用宿主机网络，端口固定（8000/8001）
- **只能同时跑 1 个容器**（端口冲突）
- 容器内用 `localhost` 访问宿主机
- **`host.docker.internal` 不可用！** 会导致 MCP 连接失败

```bash
# Host 模式
AGENT_SERVER_USE_HOST_NETWORK=true BACKEND_HOST=0.0.0.0 FRONTEND_HOST=0.0.0.0 make run
```

**结论: 生产环境用 bridge 模式，host 模式仅在特殊场景下使用。**

### 4.4 Host 模式下的 "Failed to connect to server"

**症状**: 会话创建成功，但 Agent 报 "Failed to connect to server"

**原因**: Host 网络模式下，容器直接用宿主机网络栈，`host.docker.internal` DNS 名称无法解析。OpenHands 的 webhook 回调和 MCP 服务默认用 `host.docker.internal`。

**日志关键字**:
```
RuntimeError: Client failed to connect: [Errno -2] Name or service not known
```

**解决**: 不要用 host 模式，或者需要修改以下两处代码（不推荐，维护成本高）：
- `docker_sandbox_service.py` 第 382 行：webhook 回调地址
- `live_status_app_conversation_service.py` 第 2005 行：MCP/web URL

### 4.5 SANDBOX_CONTAINER_URL_PATTERN 不要设公网 IP

**症状**: 设置 `SANDBOX_CONTAINER_URL_PATTERN=http://公网IP:{port}` 后，Agent Server 报 401

**原因**: 这个环境变量影响所有 URL，包括 App Server 内部连 Agent Server 的 URL。App Server 和 Agent Server 在同一台机器上，内部通信走公网 IP 会导致：
- 网络绕路（出去再回来）
- 可能被安全组/防火墙拦截
- Token 校验可能因 Host header 不匹配而失败

**解决**: **不要设这个变量**。保持默认的 `http://localhost:{port}`。前端的 `transformVSCodeUrl()` 会自动把 `localhost` 替换成浏览器的 hostname，不需要后端操心。

### 4.6 Code 标签（VSCode）打不开

**可能原因及排查**:

| 原因 | 排查方法 | 解决 |
|------|----------|------|
| 容器还没启动完 | `docker ps` 看状态 | 等几秒 |
| token 不匹配 | 检查 URL 中的 `tkn=` 参数 | 新建会话 |
| 端口不可达（公网访问） | 安全组检查 | 开放对应端口 |
| 跨协议（https 页面嵌 http iframe） | 检查浏览器控制台 | 统一协议 |

**VSCode URL 获取链路**:
```
前端 useVSCodeUrl()
  → GET /api/vscode/url (agent-server)
  → 返回 http://localhost:随机端口/?tkn=xxx
  → transformVSCodeUrl() 替换 localhost 为浏览器 hostname
  → iframe 加载
```

### 4.7 Swap 配置（内存不足）

**症状**: 8GB 内存的机器同时跑 OpenHands + 多个 Docker 容器，内存不足

**解决**:
```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### 4.8 LLM 模型工具调用兼容性

**症状**: Agent 执行 Skill 时报 `Error validating args for tool 'think': Expecting property name enclosed in double quotes`

**原因**: 某些模型（如 qwen-plus）在生成工具调用参数时，JSON 格式不标准（中文引号、缺少双引号等），导致参数解析失败，Agent 陷入错误重试循环。

**解决**: 换工具调用能力更强的模型（如 `qwen-max`、`claude-sonnet`、`gpt-4o`）。

## 5. Git 仓库管理

```bash
# 远程仓库配置
origin   → https://github.com/yizeng1100-dot/hiclaw.git   # 私有仓库
upstream → https://github.com/OpenHands/OpenHands.git      # 官方上游

# 同步上游更新
git fetch upstream
git merge upstream/main
# 解决冲突（搜索 ">>> CUSTOM: HiClaw <<<" 标记）
git push origin main
```

## 6. 自定义代码标记

所有对 OpenHands 原文件的修改都用以下注释标记，方便合并上游时识别：

```
# >>> CUSTOM: HiClaw <<<
... 自定义代码 ...
# >>> END CUSTOM <<<
```

当前修改的原文件列表（每个只改了几行）：

| 文件 | 改动内容 |
|------|----------|
| `openhands/app_server/v1_router.py` | 动态加载 custom skill API 路由 |
| `openhands/app_server/app_conversation/app_conversation_service_base.py` | 注入数据库管理的 Skills |
| `frontend/src/routes.ts` | 添加 skill-management 路由 |
| `frontend/src/components/features/sidebar/sidebar.tsx` | 侧边栏 Skill 管理按钮 |
| `frontend/src/components/features/chat/components/chat-input-row.tsx` | 聊天输入框 Skill 选择器 |
| `frontend/src/components/features/chat/components/chat-input-container.tsx` | 传递 onActivateSkill prop |
| `frontend/src/components/features/chat/custom-chat-input.tsx` | 传递 onActivateSkill prop |
| `frontend/src/components/features/chat/interactive-chat-box.tsx` | Skill 激活逻辑 + 徽章 |
