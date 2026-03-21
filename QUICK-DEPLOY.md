# HiClaw (定制版 OpenHands) 快速部署

## 目标服务器要求

- Linux（Ubuntu 20.04+）
- Docker 已安装
- 内存 >= 8GB
- 磁盘 >= 30GB

**不需要**：Python、Node.js、Poetry、源码

## 部署步骤

### 1. 传输镜像到目标服务器

```bash
# 方式一：scp 传输（376MB）
scp hiclaw-latest.tar.gz user@target-server:/tmp/

# 方式二：如果有私有镜像仓库
docker tag hiclaw:latest your-registry.com/hiclaw:latest
docker push your-registry.com/hiclaw:latest
```

### 2. 在目标服务器加载镜像

```bash
# 方式一：从 tar.gz 加载
docker load < /tmp/hiclaw-latest.tar.gz

# 方式二：从私有仓库拉取
docker pull your-registry.com/hiclaw:latest
docker tag your-registry.com/hiclaw:latest hiclaw:latest
```

### 3. 启动

```bash
docker run -d \
  --name hiclaw \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.openhands:/.openhands \
  -e LLM_MODEL=openai/qwen-max \
  -e LLM_API_KEY=your-api-key-here \
  -e LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
  hiclaw:latest
```

### 4. 访问

浏览器打开 `http://服务器IP:3000`

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|:---:|------|
| `LLM_MODEL` | 是 | 模型名称，如 `openai/qwen-max` |
| `LLM_API_KEY` | 是 | 模型 API Key |
| `LLM_BASE_URL` | 否 | 自定义 API 地址（非 OpenAI 时需要） |
| `SANDBOX_USER_ID` | 否 | 沙箱用户 ID，默认 0 (root) |
| `WORKSPACE_MOUNT_PATH` | 否 | 挂载宿主机目录到沙箱 |

## 数据持久化

`-v ~/.openhands:/.openhands` 挂载了数据目录，包含：
- `settings.json` — 用户设置
- `openhands.db` — 会话元数据 + Skill 管理数据
- `sessions/` — 会话事件历史

## 管理命令

```bash
# 查看日志
docker logs -f hiclaw

# 停止
docker stop hiclaw

# 重启
docker restart hiclaw

# 删除
docker rm -f hiclaw

# 更新（重新构建后）
docker rm -f hiclaw
docker load < hiclaw-latest.tar.gz
docker run -d ... (同上)
```

## 注意事项

- 容器需要访问 Docker socket（`-v /var/run/docker.sock`），因为 Agent 运行在独立的 Docker 容器中
- 首次启动会自动拉取 `ghcr.io/openhands/agent-server:1.14.0-python` 镜像（约 10GB）
- 如果目标服务器网络受限，可以在有网络的机器上先拉取 agent-server 镜像，再 `docker save/load` 传过去
