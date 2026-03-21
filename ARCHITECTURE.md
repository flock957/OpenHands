# HiClaw 项目架构文档

> 基于 OpenHands 的企业内网 AI 编程平台
> 维护人: gyz | 最后更新: 2026-03-21

---

## 一、OpenHands 现有架构

### 1.1 系统总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户浏览器                                  │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │   会话聊天    │  │  Code(VSCode) │  │   终端/浏览器  │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└──────────┼─────────────────┼─────────────────┼─────────────────────┘
           │ HTTP :3000      │ HTTP :随机端口    │ HTTP :随机端口
           ▼                 ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        宿主机 (Linux)                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │                   App Server (调度层)                       │      │
│  │                   FastAPI + React                           │      │
│  │                   端口: 3000 (后端API + 前端静态)            │      │
│  │                   开发模式: 3000(后端) + 3001(前端)          │      │
│  │                                                             │      │
│  │  职责:                                                      │      │
│  │   • 用户设置管理 (LLM模型/Key/URL)                          │      │
│  │   • 会话生命周期管理 (创建/列表/删除)                        │      │
│  │   • 沙箱容器管理 (创建/暂停/恢复/删除)                      │      │
│  │   • Skill 加载与注入                                        │      │
│  │   • 事件存储与转发                                           │      │
│  │   • MCP 服务                                                │      │
│  │   • 前端页面服务                                             │      │
│  │                                                             │      │
│  │  不做:                                                      │      │
│  │   ✗ 不执行任何 Agent 逻辑                                   │      │
│  │   ✗ 不调用 LLM API                                         │      │
│  │   ✗ 不执行 bash/编辑文件                                    │      │
│  └───────────────────────┬─────────────────────────────────────┘      │
│                          │                                            │
│              HTTP (X-Session-API-Key 认证)                            │
│                          │                                            │
│  ┌───────────────────────▼─────────────────────────────────────┐      │
│  │              Agent Server (执行层)                           │      │
│  │              Docker 容器, 每个会话独立                        │      │
│  │              镜像: ghcr.io/openhands/agent-server:1.14.0     │      │
│  │              代码: 外部包 openhands-sdk==1.14                 │      │
│  │                                                             │      │
│  │  端口 (容器内 → 宿主机随机映射):                              │      │
│  │   • 8000 → :随机  Agent HTTP API                            │      │
│  │   • 8001 → :随机  OpenVSCode Server (Code标签)              │      │
│  │   • 8011 → :随机  Worker 1                                  │      │
│  │   • 8012 → :随机  Worker 2                                  │      │
│  │                                                             │      │
│  │  职责:                                                      │      │
│  │   • 运行 Agent 循环 (LLM推理 → 工具执行 → 观察)             │      │
│  │   • 调用 LLM API (通过 litellm)                             │      │
│  │   • 执行工具: bash终端 / 文件编辑 / 浏览器 / MCP            │      │
│  │   • 提供 VSCode Web IDE                                     │      │
│  │   • Skill 文件加载 (从容器内 /skills/ 目录)                  │      │
│  │   • 事件记录 (/workspace/conversations/)                     │      │
│  │                                                             │      │
│  │  文件系统:                                                   │      │
│  │   /workspace/project/     ← 用户工作目录                     │      │
│  │   /workspace/conversations/ ← 会话事件存储                   │      │
│  │   /openhands/.openvscode-server/ ← VSCode                  │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                      │
│  可同时运行多个 Agent Server 容器 (默认最多5个)                       │
│  超出限制时, 最旧的容器被暂停 (pause), 不删除                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心交互流程

#### 会话创建流程

```
用户点击 "New Project"
    │
    ▼
前端 POST /api/v1/app-conversations
    │
    ▼
App Server: 读取用户设置 (model/key/url)
    │
    ▼
App Server: 创建 Docker 容器 (agent-server)
    │   docker run ghcr.io/openhands/agent-server:1.14.0
    │   映射端口: 8000→随机, 8001→随机
    │   注入环境变量: SESSION_API_KEY, WEBHOOK_URL
    ▼
App Server: 等待容器健康检查通过
    │   GET http://host.docker.internal:{port}/health
    ▼
App Server: 加载 Skills
    │   POST http://{agent-server}/api/skills
    │   返回 38+ 个 Skill (公共 + 用户 + 项目 + 组织)
    ▼
App Server: 构建 StartConversationRequest
    │   包含: Agent对象(LLM配置固化), Skills, 工具列表, MCP配置
    ▼
App Server: POST http://{agent-server}/api/conversations
    │
    ▼
前端显示: 会话就绪, 可以发送消息
```

#### 消息处理流程

```
用户发送消息: "帮我写一个Python脚本"
    │
    ▼
前端 → App Server: POST /api/v1/app-conversations/{id}/events
    │
    ▼
App Server → Agent Server: POST /api/conversations/{id}/events
    │   Header: X-Session-API-Key
    │   Body: { role: "user", content: "...", run: true }
    │
    ▼
Agent Server 内部: Agent.step() 执行
    │
    ├── 1. 构建消息历史 (系统提示 + Skills上下文 + 历史 + 用户消息)
    │
    ├── 2. 调用 LLM: litellm.completion(model="openai/qwen-max", ...)
    │      → HTTPS请求到模型API (dashscope/openai/anthropic)
    │      ← 返回 Action: { tool: "terminal", args: { command: "..." } }
    │
    ├── 3. 执行工具: 在容器内运行 bash 命令
    │      → 创建文件 / 安装依赖 / 运行测试
    │      ← 返回 Observation: { output: "..." }
    │
    ├── 4. 生成事件, 存储到 /workspace/conversations/
    │
    └── 5. 通过 Webhook 回调 App Server
           POST http://host.docker.internal:3000/api/v1/webhooks/events/{id}
    │
    ▼
App Server: 存储事件到本地 (events/)
    │
    ▼
前端轮询: GET /api/v1/conversation/{id}/events/search
    │
    ▼
用户看到: Agent 的回复和执行结果
```

### 1.3 数据存储

```
~/.openhands/                          ← App Server 数据目录
├── settings.json                      ← 用户设置 (LLM配置, 语言, 偏好)
├── secrets.json                       ← 用户密钥 (Git tokens 等)
├── openhands.db                       ← SQLite 数据库
│   ├── conversation_metadata          ← 会话元数据 (标题,仓库,模型,成本)
│   ├── app_conversation_start_task    ← 会话启动任务状态
│   ├── v1_remote_sandbox              ← 远程沙箱记录
│   ├── pending_messages               ← 待处理消息队列
│   ├── event_callback                 ← 事件回调注册
│   └── event_callback_result          ← 事件回调结果
└── sessions/{conversation_id}/        ← 会话事件 (JSON文件)
    ├── events/
    │   ├── 0.json
    │   ├── 1.json
    │   └── ...
    └── metadata.json
```

### 1.4 Skill 系统

```
Skill 来源 (按加载优先级):
    │
    ├── 1. 公共 Skills (/skills/ 目录, 内置37个)
    │      github.md, code-review.md, docker.md, ssh.md ...
    │
    ├── 2. 用户 Skills (~/.openhands/skills/)
    │
    ├── 3. 项目 Skills (仓库 .openhands/skills/)
    │
    └── 4. 组织 Skills (org/.openhands/ 仓库)

Skill 格式 (Markdown + YAML frontmatter):
    ---
    name: code-review
    type: knowledge
    triggers:
    - /review
    - code review
    ---
    你是一个代码审查专家...

加载链路:
    App Server → POST agent-server/api/skills
              → agent-server 读取所有来源
              → 返回 Skill 列表
              → 注入 Agent 上下文 (agent_context.skills)
              → Agent 根据触发器自动激活对应 Skill
```

### 1.5 沙箱管理

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| max_num_sandboxes | 5 | 最大同时运行容器数 |
| sandbox_grouping_strategy | NO_GROUPING | 每个会话独占容器 |
| max_num_conversations_per_sandbox | 20 | 每容器最大会话数 (分组模式) |
| startup_grace_seconds | 15 | 容器启动等待时间 |
| 网络模式 | bridge | 端口随机映射 |
| 资源限制 | 无 | 不限制 CPU/内存 |

容器生命周期:
```
创建 (docker run) → 运行中 (RUNNING) → 暂停 (PAUSED) → 恢复 (RUNNING)
                                      ↘ 删除 (REMOVED)
```

### 1.6 现有功能清单

| 功能 | 状态 | 说明 |
|------|:---:|------|
| AI 对话编程 | ✅ | 核心功能, 支持多种 LLM |
| Docker 沙箱隔离 | ✅ | 每会话独立容器 |
| VSCode Web IDE | ✅ | 容器内文件编辑 |
| Web 终端 | ✅ | 容器内 bash |
| 内置浏览器 | ✅ | Agent 可浏览网页 |
| Skill 系统 | ✅ | 文件管理, 触发器激活 |
| Git 集成 | ✅ | GitHub/GitLab/Azure DevOps |
| 多会话 | ✅ | 最多5个同时运行 |
| 会话历史 | ✅ | 事件持久化 |
| LLM 模型切换 | ⚠️ | 仅在新会话生效 |
| 多用户隔离 | ❌ | OSS版单用户, 无认证 |
| SSO 登录 | ❌ | 仅 Enterprise 版有 |
| Skill 版本管理 | ❌ | 无 |
| Skill 增删改查 | ❌ | 文件管理, 无 API |
| 工作流编排 | ❌ | 无 DAG 引擎 |
| 远程服务器管理 | ❌ | 仅本地 Docker |
| 资源监控 | ❌ | 无 |
| 容器资源限制 | ❌ | 无 CPU/内存限制 |

---

## 二、HiClaw 定制需求

### 2.1 需求总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      HiClaw 定制化层                             │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Skill    │ │ 工作流   │ │ 远程服务器│ │ 资源监控 │           │
│  │ 管理     │ │ 引擎     │ │ 管理     │ │         │           │
│  │ (P0)     │ │ (P0)     │ │ (P1)     │ │ (P1)    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐                                      │
│  │ 用户管理 │ │ SSO     │                                      │
│  │ (P1)     │ │ (P2)    │                                      │
│  └──────────┘ └──────────┘                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 最小改动原文件, 通过注入/配置接入
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenHands 原生平台                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 需求详情

#### 需求1: Skill 管理与版本控制 (P0) ← 已实现基础版

**现状**: Skill 以 .md 文件存储, 无 CRUD API, 无版本管理, 无搜索

**目标**:
- 数据库管理 Skill (增删改查 + 搜索)
- 多文件 Skill (一个 Skill = 多个 .md + .py 脚本)
- 版本控制 (版本对比、回滚、效果标注)
- 全局共享 (管理员配置, 所有用户可用)
- 会话中 UI 选择 Skill 触发执行

**已完成**:
- [x] 数据库表设计 (ManagedSkill + SkillVersion + SkillScript)
- [x] CRUD + 搜索 API
- [x] 多文件上传 + 文件浏览器预览
- [x] Skill 版本管理 (创建版本、回滚)
- [x] 前端管理页面 (侧边栏入口)
- [x] 会话中 Skill 选择器 (扳手按钮)
- [x] 与 OpenHands 原生 Skill 管线集成 (bridge.py)

**待完成**:
- [ ] Skill 版本 Diff 对比视图
- [ ] Skill 效果评价/标注系统
- [ ] 脚本在线编辑 (Monaco Editor)

#### 需求2: 工作流引擎 (P0)

**现状**: Agent 由 LLM 自由决策执行顺序, 无确定性编排

**目标**:
```
YAML 定义工作流:
  step1: code-review-skill (超时30m)
      ↓ on_success
  step2: run-tests-skill (超时1h)
      ↓ on_success
  step3: human_input (用户确认部署目标)
      ↓ on_success
  step4: deploy-skill (超时2h)
      ↓ on_failure
  step5: rollback-skill
```

**待完成**:
- [ ] 工作流 YAML 定义格式
- [ ] 工作流引擎 (步骤调度、分支、超时)
- [ ] 人工输入节点 (WebSocket 推送表单)
- [ ] 工作流管理 API + 前端页面
- [ ] 会话中工作流触发面板

#### 需求3: 用户自配计算服务器 (P1)

**现状**: 所有容器只能在本地 Docker 创建

**目标**: 用户填入远程服务器 IP + SSH 凭证, 会话容器在远程服务器创建

```
用户 → 添加服务器 (IP + SSH Key)
         ↓
系统自动: SSH连接 → 安装Docker → 部署Node Agent → 连通测试
         ↓
用户开启会话 → 容器在远程服务器创建
```

**待完成**:
- [ ] Node Agent 轻量服务 (兼容 RemoteSandbox API)
- [ ] 服务器自动初始化脚本
- [ ] 服务器管理 API + 前端页面
- [ ] 用户沙箱路由 (根据配置选择服务器)

#### 需求4: 资源监控 (P1)

**现状**: 无资源监控, 无容器指标

**目标**: 监控仪表板显示服务器/容器的 CPU/内存/磁盘使用

**待完成**:
- [ ] 指标采集服务
- [ ] 监控 API + 前端仪表板

#### 需求5: 用户管理 (P1)

**现状**: OSS 版单用户模式, 所有人共用数据

**目标**: 多用户隔离, 每用户独立会话/设置

**待完成**:
- [ ] 用户表设计
- [ ] 用户 CRUD API + 前端页面
- [ ] 会话所有权隔离
- [ ] 多用户协作 (共享会话)

#### 需求6: SSO 登录 (P2)

**现状**: 无认证

**目标**: 对接公司 SSO

**待完成**:
- [ ] SSO UserAuth 实现
- [ ] 前端登录页

### 2.3 额外已完成功能

| 功能 | 说明 |
|------|------|
| LLM 错误内联换模型 | API 报错时直接在错误横幅中更换模型配置 |
| 模型热切换 (docker commit) | 快照容器 → 新模型重启 → 文件保留 |
| Docker 打包部署 | Dockerfile.hiclaw, 一条命令部署 |

---

## 三、HiClaw 技术架构

### 3.1 代码组织

```
OpenHands/
├── openhands/                    ← OpenHands 原生代码 (尽量不改)
│   ├── server/                   ← 入口, 认证, 旧版API
│   ├── app_server/               ← V1 API, 核心服务
│   │   ├── v1_router.py          ← [改] 注册自定义路由
│   │   ├── app_conversation/     ← 会话管理
│   │   │   └── app_conversation_service_base.py ← [改] 注入自定义Skills
│   │   ├── sandbox/              ← 沙箱/容器管理
│   │   ├── user/                 ← 用户上下文
│   │   └── event/                ← 事件服务
│   ├── storage/                  ← 数据模型, 设置存储
│   └── agenthub/                 ← Agent 定义 (CodeActAgent)
│
├── custom/                       ← HiClaw 定制代码 (全部在这里)
│   ├── __init__.py
│   ├── skill_mgmt/
│   │   ├── models.py             ← 数据库模型 (Skill/Version/Script)
│   │   ├── service.py            ← Skill CRUD 服务
│   │   ├── router.py             ← Skill API 路由
│   │   ├── conversation_router.py ← 模型热切换 API
│   │   ├── bridge.py             ← 自定义Skill → OpenHands Skill 桥接
│   │   └── db.py                 ← 数据库连接管理
│   └── skill_examples/           ← 示例 Skill 文件
│
├── frontend/src/
│   ├── routes.ts                 ← [改] 添加 skill-management 路由
│   ├── routes/
│   │   └── skill-management.tsx  ← Skill 管理页面入口
│   ├── api/
│   │   └── custom-skill-service/ ← Skill API 客户端
│   └── components/features/
│       ├── sidebar/sidebar.tsx   ← [改] 添加 Skill 按钮
│       ├── chat/
│       │   ├── chat-input-row.tsx         ← [改] 添加 Skill 选择器
│       │   ├── chat-input-container.tsx   ← [改] 传递 onActivateSkill
│       │   ├── custom-chat-input.tsx      ← [改] 传递 onActivateSkill
│       │   ├── interactive-chat-box.tsx   ← [改] Skill 激活逻辑
│       │   └── error-message-banner.tsx   ← [改] 模型切换表单
│       └── custom/
│           └── skill-management/          ← Skill 管理 UI 组件
│               ├── skill-management-page.tsx
│               ├── skill-detail-panel.tsx
│               ├── skill-upload-modal.tsx
│               ├── skill-selector.tsx
│               └── skill-active-badge.tsx
│
├── containers/app/
│   ├── Dockerfile                ← OpenHands 原版
│   └── Dockerfile.hiclaw         ← HiClaw 定制版 (含 custom/)
│
├── ARCHITECTURE.md               ← 本文档
├── REQUIREMENTS.md               ← 详细需求文档
├── DEPLOYMENT.md                 ← 部署运维踩坑手册
└── QUICK-DEPLOY.md               ← Docker 快速部署指南
```

### 3.2 对原文件的改动清单

所有改动用 `>>> CUSTOM: HiClaw <<<` 注释标记, 合并上游时搜索即可定位。

| 文件 | 改动行数 | 改动内容 |
|------|:------:|----------|
| `v1_router.py` | +6 | 动态加载 custom 路由 (try/except) |
| `app_conversation_service_base.py` | +7 | load_and_merge_all_skills 后注入自定义 Skills |
| `routes.ts` | +2 | 添加 /skill-management 路由 |
| `sidebar.tsx` | +3 | 侧边栏 Skill 管理按钮 |
| `chat-input-row.tsx` | +8 | Skill 选择器按钮 |
| `chat-input-container.tsx` | +3 | 传递 onActivateSkill prop |
| `custom-chat-input.tsx` | +3 | 传递 onActivateSkill prop |
| `interactive-chat-box.tsx` | +15 | Skill 激活状态 + 徽章 |
| `error-message-banner.tsx` | +80 | LLM 错误检测 + 模型切换表单 |
| **合计** | **~127行** | |

### 3.3 Skill 管理数据模型

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  managed_skill   │     │  skill_version   │     │  skill_script    │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK, UUID)    │◄──┐ │ id (PK, UUID)    │     │ id (PK, UUID)    │
│ name (unique)    │   │ │ skill_id (FK) ───┘     │ skill_id (FK) ───┘
│ description      │   │ │ version (int)    │     │ filename         │
│ category         │   │ │ content (text)   │     │ language         │
│ skill_type       │   │ │ changelog        │     │ content (text)   │
│ triggers (json)  │   │ │ performance_notes│     │ description      │
│ tags (json)      │   │ │ is_current (bool)│     │ created_at       │
│ is_global        │   │ │ created_by       │     │ updated_at       │
│ is_active        │   │ │ created_at       │     └──────────────────┘
│ created_by       │   │ └──────────────────┘
│ current_version  │   │
│ created_at       │   │  一个 Skill 有多个版本
│ updated_at       │   │  一个 Skill 有多个脚本文件
└──────────────────┘   │
                       └─ 1:N 关系
```

### 3.4 Skill 集成链路

```
App Server 启动会话
    │
    ▼
load_and_merge_all_skills()
    │
    ├── 1. 调用 agent-server /api/skills → 获取原生 Skills (37个)
    │
    ├── 2. 调用 custom/skill_mgmt/bridge.py → 获取自定义 Skills
    │      读取数据库 managed_skill 表 (is_active=True)
    │      转换为原生 Skill 对象 (含 content + 脚本)
    │
    └── 3. 合并去重 → 注入 agent_context.skills
              │
              ▼
    Agent 启动时已拥有所有 Skills
    用户触发 → Agent 识别并执行
```

### 3.5 部署架构

#### 开发模式

```
宿主机直接运行 App Server (make run)
    ├── uvicorn :3000  (后端)
    ├── vite :3001     (前端 dev server)
    └── Docker 容器 × N  (agent-server)
```

#### 生产模式 (Docker 打包)

```
docker run hiclaw:latest
    │
    ├── hiclaw 容器 (:3000)
    │   ├── uvicorn (后端 + 前端静态文件)
    │   ├── 挂载 docker.sock (管理 agent-server 容器)
    │   └── 挂载 ~/.openhands (数据持久化)
    │
    └── agent-server 容器 × N (自动创建)
        ├── Agent + LLM
        ├── VSCode
        └── 工作目录
```

启动命令:
```bash
docker run -d --name hiclaw \
  -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.openhands:/.openhands \
  -e LLM_MODEL=openai/glm-4.7 \
  -e LLM_API_KEY=your-key \
  -e LLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4 \
  hiclaw:latest
```

### 3.6 Git 分支管理

```
upstream (github.com/OpenHands/OpenHands)
    │
    │  git fetch upstream && git merge upstream/main
    ▼
origin/main (github.com/yizeng1100-dot/hiclaw) ← 同步上游
    │
    ├── origin/test     ← 开发分支 (含所有定制代码)
    └── origin/outfile  ← Docker 镜像包 (Git LFS)
```

---

## 四、关键技术决策记录

| 决策 | 原因 |
|------|------|
| 自定义代码集中在 `custom/` 目录 | 最小化对原文件的改动, 便于合并上游 |
| 用 `try/except ImportError` 动态加载 | custom/ 不存在时不影响原系统 |
| Skill 存数据库而非文件 | 支持搜索/版本管理/多文件/API 管理 |
| 通过 bridge.py 桥接而非改 agent-server | agent-server 是外部包, 无法修改 |
| 模型热切换用 docker commit | agent-server 无运行时配置更新 API |
| 打包时用独立 Dockerfile.hiclaw | 不覆盖原版 Dockerfile |
| 前端改动用注释标记 | 合并上游时快速定位冲突 |
| bridge 模式而非 host 网络 | 支持多容器同时运行 |
| `--add-host=host.docker.internal:host-gateway` | Docker-in-Docker 场景必须 |
