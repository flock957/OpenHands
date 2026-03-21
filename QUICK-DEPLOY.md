# HiClaw 内网部署指南

## 打包内容

`hiclaw-full.tar.gz`（约 1.6 GB）包含两个 Docker 镜像：

| 镜像 | 大小 | 用途 |
|------|------|------|
| `hiclaw:latest` | ~1.9 GB | App Server（前端 + 后端 + Skill 管理） |
| `ghcr.io/openhands/agent-server:1.14.0-python` | ~4.6 GB | Agent Server（AI 执行引擎 + VSCode） |

## 目标服务器要求

- Linux（Ubuntu 20.04+）
- **Docker** 已安装
- 内存 >= 8GB（建议 16GB）
- 磁盘 >= 30GB

**不需要**：Python、Node.js、npm、源码、编译

## 部署步骤

### 第 1 步：传输文件到目标服务器

```bash
scp hiclaw-full.tar.gz user@目标服务器:/tmp/
```

### 第 2 步：加载镜像

```bash
ssh user@目标服务器
docker load < /tmp/hiclaw-full.tar.gz
# 输出：
#   Loaded image: hiclaw:latest
#   Loaded image: ghcr.io/openhands/agent-server:1.14.0-python
```

验证镜像已加载：
```bash
docker images | grep -E "hiclaw|agent-server"
```

### 第 3 步：启动

```bash
docker run -d \
  --name hiclaw \
  --restart unless-stopped \
  -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.openhands:/.openhands \
  -e LLM_MODEL=openai/你的模型名 \
  -e LLM_API_KEY=你的API密钥 \
  -e LLM_BASE_URL=你的API地址 \
  hiclaw:latest
```

### 第 4 步：访问

浏览器打开 `http://服务器IP:3000`

## 启动参数详解

```bash
docker run -d \
  --name hiclaw \                                      # 容器名称
  --restart unless-stopped \                           # 崩溃自动重启
  -p 3000:3000 \                                       # 前端+后端端口
  --add-host=host.docker.internal:host-gateway \       # ★ 必须！解决容器间通信
  -v /var/run/docker.sock:/var/run/docker.sock \       # ★ 必须！管理 Agent 容器
  -v ~/.openhands:/.openhands \                        # 数据持久化目录
  -e LLM_MODEL=openai/你的模型名 \                     # LLM 模型
  -e LLM_API_KEY=你的API密钥 \                          # LLM API Key
  -e LLM_BASE_URL=你的API地址 \                         # LLM API 地址
  hiclaw:latest
```

### 必须参数说明

| 参数 | 为什么必须 |
|------|-----------|
| `--add-host=host.docker.internal:host-gateway` | App 容器需要通过此域名连接它创建的 Agent 容器，不加会报 500 |
| `-v /var/run/docker.sock:/var/run/docker.sock` | App 容器需要创建/管理 Agent 容器（Docker-in-Docker） |

### 可选参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-e POSTHOG_CLIENT_KEY=disabled` | 已默认禁用 | 禁止向外网发送遥测数据 |
| `-e SANDBOX_USER_ID=1000` | 0 (root) | Agent 容器内运行用户的 UID |
| `-v /your/workspace:/opt/workspace_base` | 无 | 挂载宿主机目录到 Agent 工作区 |

## 常用 LLM 配置示例

### 通义千问（阿里云）
```bash
-e LLM_MODEL=openai/qwen-max \
-e LLM_API_KEY=sk-xxxx \
-e LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 智谱 GLM
```bash
-e LLM_MODEL=openai/glm-4.7 \
-e LLM_API_KEY=xxxx.yyyy \
-e LLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
```

### OpenAI
```bash
-e LLM_MODEL=gpt-4o \
-e LLM_API_KEY=sk-xxxx
# 不需要 LLM_BASE_URL，默认就是 OpenAI
```

### Claude (Anthropic)
```bash
-e LLM_MODEL=anthropic/claude-sonnet-4-20250514 \
-e LLM_API_KEY=sk-ant-xxxx
```

### 内网私有模型（兼容 OpenAI 接口）
```bash
-e LLM_MODEL=openai/你的模型名 \
-e LLM_API_KEY=任意非空值 \
-e LLM_BASE_URL=http://内网地址:端口/v1
```

## 管理命令

```bash
# 查看运行状态
docker ps | grep hiclaw

# 查看日志
docker logs -f hiclaw

# 查看 Agent 容器
docker ps | grep oh-agent-server

# 停止
docker stop hiclaw

# 重启
docker restart hiclaw

# 完全删除（数据保留在 ~/.openhands）
docker rm -f hiclaw

# 清理所有 Agent 容器
docker rm -f $(docker ps -aq --filter "name=oh-agent-server")
```

## 更新部署

```bash
# 1. 传输新的镜像包
scp hiclaw-full.tar.gz user@目标服务器:/tmp/

# 2. 停掉旧容器
docker stop hiclaw && docker rm hiclaw

# 3. 加载新镜像（会覆盖旧的）
docker load < /tmp/hiclaw-full.tar.gz

# 4. 重新启动（同第 3 步的命令）
docker run -d ... hiclaw:latest
```

## 数据目录说明

`~/.openhands/` 是数据持久化目录：

```
~/.openhands/
├── settings.json         ← LLM 配置（首次通过 Web 设置后自动生成）
├── openhands.db          ← 会话元数据 + Skill 管理数据
└── sessions/             ← 会话历史事件
```

删除容器不会丢失数据，重新 `docker run` 挂载同一目录即可恢复。

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 500: Sandbox entered error state | 缺少 `--add-host` 参数 | 加上 `--add-host=host.docker.internal:host-gateway` |
| 会话一直 Starting | 旧 Agent 容器占用配额 | `docker rm -f $(docker ps -aq --filter "name=oh-agent-server")` 后重试 |
| Code 标签打不开 | Agent 容器端口是随机的，外部防火墙未放行 | 在宿主机浏览器用 localhost 访问，或防火墙开放 30000-65535 |
| PostHog 外网请求 | 遥测未禁用 | 已默认禁用，确认 `POSTHOG_CLIENT_KEY=disabled` |
| LLM API 报错 | 模型配额耗尽或 Key 无效 | 会话中点"更换模型"切换 |
