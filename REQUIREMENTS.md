# OpenHands 企业内网定制化需求文档

> 维护人: gyz | 最后更新: 2026-03-19
> 本文档既是需求说明，也是开发任务追踪。每个需求包含：背景分析、实现方案、关键文件、任务拆分。

---

## 总体原则

### 代码解耦策略

为保证能持续跟随 OpenHands 上游更新，所有定制化代码遵循以下原则：

1. **新增文件优先** — 自定义逻辑放在新文件中，通过配置/注入方式接入，不修改原有文件
2. **自定义代码集中存放** — 所有定制模块统一放在 `custom/` 目录下
3. **利用现有扩展点** — OpenHands 已有可插拔的 `UserAuth`、`SandboxService`、`Injector` 等抽象接口，优先通过实现接口扩展
4. **最小化原文件改动** — 必须改原文件时，改动尽量小（如仅在配置/路由注册处加一行）
5. **上游同步方式** — 设置 upstream remote，定期 `git fetch upstream && git merge upstream/main`

### 目录结构规划

```
OpenHands/
├── custom/                          # 所有定制化代码
│   ├── __init__.py
│   ├── auth/                        # 需求1: SSO认证
│   │   ├── __init__.py
│   │   ├── sso_user_auth.py         # SSO UserAuth 实现
│   │   ├── sso_config.py            # SSO 配置
│   │   └── sso_models.py            # 用户模型扩展
│   ├── user_mgmt/                   # 需求2: 用户管理
│   │   ├── __init__.py
│   │   ├── user_service.py          # 用户CRUD
│   │   ├── user_models.py           # 用户数据模型
│   │   └── user_router.py           # 用户管理API
│   ├── collaboration/               # 需求2: 会话协作
│   │   ├── __init__.py
│   │   ├── shared_session.py        # 多人会话逻辑
│   │   └── collab_websocket.py      # 多人WebSocket
│   ├── skill_mgmt/                  # 需求3: Skill管理
│   │   ├── __init__.py
│   │   ├── skill_registry.py        # Skill注册中心
│   │   ├── skill_router.py          # Skill管理API
│   │   └── skill_models.py          # Skill数据模型
│   ├── remote_server/               # 需求4: 远程服务器
│   │   ├── __init__.py
│   │   ├── server_manager.py        # 服务器管理
│   │   ├── server_provisioner.py    # 服务器环境初始化
│   │   ├── remote_docker_service.py # 远程Docker沙箱服务
│   │   ├── server_router.py         # 服务器管理API
│   │   └── server_models.py         # 服务器数据模型
│   ├── monitoring/                  # 需求5: 资源监控
│   │   ├── __init__.py
│   │   ├── monitor_service.py       # 监控采集服务
│   │   ├── monitor_router.py        # 监控API
│   │   └── monitor_models.py        # 监控数据模型
│   ├── config.py                    # 定制化总配置
│   ├── router.py                    # 定制化路由汇总
│   └── migrations/                  # 定制化数据库迁移
│       └── versions/
├── frontend/src/
│   ├── components/features/custom/  # 前端定制化组件
│   │   ├── sso-login/               # SSO登录页
│   │   ├── user-management/         # 用户管理页
│   │   ├── skill-management/        # Skill管理页
│   │   ├── server-management/       # 服务器管理页
│   │   └── monitoring-dashboard/    # 监控仪表板
│   └── api/custom/                  # 前端定制化API服务
```

---

## 需求1: SSO单点登录

### 背景分析

**OpenHands 现有认证架构：**
- 抽象基类: `openhands/server/user_auth/user_auth.py` — 定义了 `UserAuth` 接口
- OSS实现: `openhands/server/user_auth/default_user_auth.py` — 单用户，无认证
- Enterprise实现: `enterprise/server/auth/saas_user_auth.py` — Keycloak OAuth2

**扩展点：** 实现一个新的 `UserAuth` 子类，通过配置切换即可，无需改动核心代码。

### 实现方案

```
用户浏览器 → OpenHands前端 → 检测未登录 → 跳转公司SSO登录页
    ↓
SSO认证成功 → 回调OpenHands → 携带token/ticket
    ↓
OpenHands后端 → 验证token(调用SSO接口) → 创建本地会话(JWT) → 返回前端
```

**需要用户提供的信息：**
- SSO 类型（CAS / SAML / OIDC / LDAP / 自定义）
- SSO 服务器地址
- Client ID / Client Secret
- 回调URL格式
- 用户信息接口（获取用户名、邮箱、部门等）

### 关键文件（需了解）

| 文件 | 说明 |
|------|------|
| `openhands/server/user_auth/user_auth.py` | UserAuth 抽象基类，需实现的接口 |
| `openhands/server/user_auth/default_user_auth.py` | 默认实现，参考用 |
| `enterprise/server/auth/saas_user_auth.py` | Keycloak实现，参考用 |
| `openhands/app_server/config.py` | 配置注入点，切换 UserAuth 实现 |
| `frontend/src/routes/login.tsx` | 前端登录页 |
| `frontend/src/api/auth-service/auth-service.api.ts` | 前端认证API |

### 任务拆分

- [ ] **1.1** 确认公司SSO类型和接口文档
- [ ] **1.2** 实现 `custom/auth/sso_user_auth.py` — SSO UserAuth 类
- [ ] **1.3** 实现 `custom/auth/sso_config.py` — SSO 配置管理
- [ ] **1.4** 前端SSO登录页（跳转/回调处理）
- [ ] **1.5** 注入配置，切换认证实现
- [ ] **1.6** 联调测试

---

## 需求2: 用户管理 & 会话协作

### 背景分析

**现有能力：**
- OSS版无用户管理，单用户模式
- Enterprise版有组织/成员管理（`enterprise/server/routes/orgs.py`）
- 会话有 `public` 字段，但共享是**只读**的
- WebSocket 是单用户连接模式

**需要新增：**
- 用户 CRUD（基于SSO同步 + 手动管理）
- 会话所有权（每个用户看自己的会话）
- 会话共享 — **多人可写**的实时协作

### 实现方案

#### 2A: 用户管理

```
SSO登录 → 自动创建/更新本地用户记录
管理员 → 用户管理页面 → 查看/禁用/分配角色
```

**用户模型扩展：**
```python
class CustomUser:
    id: str              # SSO用户ID
    username: str        # 用户名
    email: str           # 邮箱
    display_name: str    # 显示名
    department: str      # 部门
    role: str            # admin / user
    is_active: bool      # 是否启用
    created_at: datetime
    last_login: datetime
```

#### 2B: 会话协作

```
用户A创建会话 → 邀请用户B加入 → 用户B在会话列表看到共享会话
    ↓
两人同时连接同一会话的WebSocket → 消息广播给所有参与者
    ↓
操作记录标注是谁发的（用户名标签）
```

**技术要点：**
- 扩展会话模型，增加 `participants` 字段（参与者列表）
- WebSocket 连接管理：同一会话支持多个连接
- 消息广播：一人发送的操作，其他人实时看到
- 权限控制：会话创建者可管理参与者

### 关键文件

| 文件 | 说明 |
|------|------|
| `openhands/app_server/user/user_models.py` | 现有用户模型 |
| `openhands/app_server/app_conversation/app_conversation_models.py` | 会话模型 |
| `openhands/app_server/app_conversation/sql_app_conversation_info_service.py` | 会话持久化 |
| `enterprise/server/sharing/` | 现有共享功能 |
| `frontend/src/contexts/conversation-websocket-context.tsx` | WebSocket上下文 |
| `frontend/src/routes/conversation.tsx` | 会话主界面 |

### 任务拆分

- [ ] **2.1** 设计用户表结构，创建迁移脚本
- [ ] **2.2** 实现用户 CRUD API（`custom/user_mgmt/`）
- [ ] **2.3** 前端用户管理页面
- [ ] **2.4** 会话模型扩展 — 增加参与者
- [ ] **2.5** 会话共享/邀请 API
- [ ] **2.6** WebSocket 多用户广播支持
- [ ] **2.7** 前端会话协作UI（参与者列表、操作者标签）
- [ ] **2.8** 权限控制（创建者管理参与者）

---

## 需求3: Skill 管理、版本控制 & 工作流长任务

### 背景分析

**现有 Skill 系统：**
- Skill 以 **Markdown 文件 + YAML frontmatter** 形式存储，不在数据库中
- 存储位置: `skills/`(内置), `.openhands/skills/`(项目级), `~/.openhands/skills/`(用户级)
- Skill 格式示例:
  ```yaml
  ---
  name: github
  type: knowledge          # knowledge(按需触发) 或 repo(始终激活)
  version: 1.0.0
  agent: CodeActAgent
  triggers:
  - github
  - /github-task           # / 前缀为命令触发
  ---
  具体指令内容...
  ```
- 触发方式: `/` 前缀（TaskTrigger）或关键词（KeywordTrigger），由 LLM 根据上下文决定是否激活
- 加载方式: 通过 agent-server 的 `/api/skills` 端点加载
- **无增删改 API**、**无搜索**、**无版本管理**、**无脚本附件**

**现有 Agent 长任务能力：**
- Agent 执行循环: LLM step → 生成 Action → 执行工具 → 获取 Observation → 循环
- 控制限制: `max_iterations`(迭代次数) 和 `max_budget_per_task`(USD预算)，**无时间限制**
- 历史压缩: Condenser 机制防止上下文溢出
- 多 Agent 委托: `AgentDelegateAction` 可委派子 Agent 执行子任务
- **无工作流 DAG 编排系统** — Skill 只给 Agent 提供上下文，由 LLM 自由决策执行顺序

**需要新增：**
- Skill CRUD 管理（数据库存储 + 搜索）
- Skill 版本控制（对比不同版本优劣）
- Skill 附件脚本管理（.py 等）
- 全局共享（管理员配置，所有用户可用）
- **工作流引擎**（编排多个 Skill 为确定性的长任务流程）
- 会话中 UI 点按触发工作流
- 工作流中的人工输入节点

### 实现方案

#### 3A: Skill 管理与版本控制

```
管理员/用户 → Skill管理页 → 新建Skill
    ↓
填写: 名称、描述、分类、触发器
编辑: Skill指令内容（Markdown编辑器）
上传: 关联脚本文件（.py, .sh 等）
    ↓
保存 → 版本号自动递增(v1.0.0 → v1.0.1)
    ↓
版本历史:
  ├── 查看每个版本的内容
  ├── Diff 对比两个版本
  ├── 回滚到指定版本
  └── 版本标注（标记哪个版本效果最好）
```

**Skill 完整数据模型：**
```python
class ManagedSkill:
    id: str                   # UUID
    name: str                 # Skill 名称（唯一标识）
    description: str          # 描述
    category: str             # 分类（如: code-review, deployment, testing）
    triggers: list[str]       # 触发器列表
    skill_type: str           # knowledge / repo
    is_global: bool           # 是否全局共享（所有用户可用）
    is_active: bool           # 是否启用
    created_by: str           # 创建者用户ID
    created_at: datetime
    updated_at: datetime
    current_version: str      # 当前版本号 (semver)
    tags: list[str]           # 标签（用于搜索和分类）

class SkillVersion:
    id: str                   # UUID
    skill_id: str             # FK → ManagedSkill.id
    version: str              # 语义版本号 (1.0.0, 1.0.1, ...)
    content: str              # Skill 指令内容（Markdown）
    changelog: str            # 版本变更说明
    performance_notes: str    # 效果评价/备注（用于对比优劣）
    is_current: bool          # 是否为当前生效版本
    created_by: str
    created_at: datetime

class SkillScript:
    id: str                   # UUID
    skill_id: str             # FK → ManagedSkill.id
    filename: str             # 文件名 (e.g., deploy.py, test.sh)
    language: str             # python / bash / javascript
    content: str              # 脚本内容
    description: str          # 脚本用途说明
    version_id: str           # FK → SkillVersion.id（跟随版本管理）
    created_at: datetime
```

**搜索能力：**
- 按名称/描述模糊搜索
- 按分类/标签过滤
- 按创建者过滤
- 按激活状态过滤
- 全文搜索 Skill 内容

#### 3B: 工作流引擎（长任务编排）

**为什么不用 LLM 自由决策？**
LLM 对于复杂的多步骤长任务，执行顺序不够确定性，容易遗漏步骤或改变顺序。
工作流引擎提供**确定性的步骤编排**，每一步调用 Agent 执行具体任务，保证流程可靠。

**工作流定义格式（YAML）：**
```yaml
name: full-stack-deploy
description: "全栈应用部署工作流"
version: 1.0.0
max_duration: 24h              # 最大执行时长
steps:
  - id: code-review
    skill: code-review-skill   # 引用已注册的 Skill
    description: "代码审查"
    timeout: 30m
    on_success: run-tests
    on_failure: notify-and-stop

  - id: run-tests
    skill: test-runner-skill
    description: "运行测试套件"
    timeout: 1h
    on_success: user-confirm-deploy
    on_failure: notify-and-stop

  - id: user-confirm-deploy
    type: human_input           # 人工输入节点
    description: "确认是否继续部署"
    inputs:
      - name: deploy_target
        label: "部署目标环境"
        type: select
        options: ["staging", "production"]
        required: true
      - name: deploy_note
        label: "部署备注"
        type: text
        validation: "^.{5,200}$"  # 正则：5-200字符
        required: false
    timeout: 2h                 # 等待用户输入的超时
    on_success: do-deploy

  - id: do-deploy
    skill: deploy-skill
    description: "执行部署"
    parameters:
      target: "{{steps.user-confirm-deploy.outputs.deploy_target}}"
      note: "{{steps.user-confirm-deploy.outputs.deploy_note}}"
    timeout: 2h
    on_success: verify-deploy
    on_failure: rollback

  - id: verify-deploy
    skill: health-check-skill
    description: "部署后验证"
    timeout: 15m

  - id: rollback
    skill: rollback-skill
    description: "回滚部署"
    timeout: 30m

  - id: notify-and-stop
    skill: notification-skill
    description: "发送失败通知"
```

**工作流引擎架构：**
```
用户点击 "启动长任务" → 选择工作流 → 填写初始参数 → 确认
    ↓
WorkflowEngine 创建 WorkflowRun 实例
    ↓
按步骤顺序执行:
  ├── skill 步骤 → 将 Skill 内容 + 参数注入 Agent → Agent 执行 → 收集结果
  ├── human_input 步骤 → 前端弹出输入表单 → 等待用户填写 → 校验正则 → 继续
  └── 条件分支 → 根据上一步结果走 on_success / on_failure
    ↓
工作流状态实时推送到前端（进度条、当前步骤、日志）
    ↓
完成/失败 → 记录执行历史
```

**工作流数据模型：**
```python
class Workflow:
    id: str
    name: str
    description: str
    definition: dict          # YAML 解析后的工作流定义
    version: str
    is_global: bool           # 是否全局共享
    created_by: str
    created_at: datetime

class WorkflowRun:
    id: str
    workflow_id: str          # FK → Workflow.id
    conversation_id: str      # 关联的会话
    user_id: str              # 发起者
    status: str               # pending / running / waiting_input / completed / failed / cancelled
    current_step_id: str      # 当前执行到哪一步
    step_results: dict        # 每步的执行结果
    started_at: datetime
    completed_at: datetime
    error_detail: str

class WorkflowStepRun:
    id: str
    workflow_run_id: str      # FK → WorkflowRun.id
    step_id: str              # 对应定义中的步骤ID
    status: str               # pending / running / waiting_input / completed / failed / skipped
    started_at: datetime
    completed_at: datetime
    inputs: dict              # 步骤输入参数
    outputs: dict             # 步骤输出结果
    agent_events: list        # Agent 执行事件记录
    error_detail: str
```

**人工输入节点 — 前端交互：**
```
工作流执行到 human_input 步骤
    ↓
前端会话中出现悬浮卡片:
  ┌─────────────────────────────────┐
  │ 🔄 工作流: 全栈应用部署           │
  │ 步骤 3/6: 确认是否继续部署        │
  │                                   │
  │ 部署目标环境:                     │
  │ ┌──────────────────────┐         │
  │ │ staging          ▼   │         │
  │ └──────────────────────┘         │
  │                                   │
  │ 部署备注:                         │
  │ ┌──────────────────────┐         │
  │ │                      │         │
  │ └──────────────────────┘         │
  │                                   │
  │    [取消工作流]    [确认继续]      │
  └─────────────────────────────────┘
```

**24 小时长任务支持方案：**
- `max_iterations` 设置为足够大的值（如 100000）
- `max_budget_per_task` 按需设置
- 工作流引擎独立于 Agent 迭代计数，引擎层面管理步骤超时
- 每个步骤独立超时控制，避免单步卡死
- 容器保持 RUNNING 状态，不被自动 pause（配置 `max_num_sandboxes` 足够大）
- Condenser 自动压缩历史，防止上下文溢出
- 步骤间可选择性清理 Agent 上下文（避免累积过多历史）

### 关键文件

| 文件 | 说明 |
|------|------|
| `openhands/app_server/app_conversation/skill_loader.py` | 现有 Skill 加载器 |
| `openhands/app_server/app_conversation/app_conversation_router.py` | 会话中 Skill 加载 |
| `skills/` | 内置 Skill 目录（Markdown 文件） |
| `openhands/agenthub/codeact_agent/codeact_agent.py` | Agent 执行循环 |
| `openhands/controller/agent_controller.py` | Agent 控制器（迭代/预算控制） |
| `openhands/controller/state/control_flags.py` | 迭代/预算限制标志 |
| `openhands/events/` | 事件模型（Action/Observation） |
| `frontend/src/components/features/chat/` | 聊天界面组件 |
| `frontend/src/contexts/conversation-websocket-context.tsx` | WebSocket 上下文 |

### 任务拆分

**Skill 管理：**
- [ ] **3.1** 设计 Skill + SkillVersion + SkillScript 表结构，创建迁移
- [ ] **3.2** 实现 Skill CRUD + 搜索 API（`custom/skill_mgmt/`）
- [ ] **3.3** 实现 Skill 版本管理 API（创建版本、Diff 对比、回滚、标注）
- [ ] **3.4** 实现 Skill 脚本附件管理 API（上传/下载/关联脚本）
- [ ] **3.5** 扩展 Skill 加载器，从数据库加载全局 Skill 并注入 Agent
- [ ] **3.6** 前端 Skill 管理页面（CRUD、搜索、分类、标签）
- [ ] **3.7** 前端 Skill 版本对比页面（Diff 视图、效果评价）
- [ ] **3.8** 前端 Skill 脚本编辑器（Monaco Editor + 语法高亮）

**工作流引擎：**
- [ ] **3.9** 设计 Workflow + WorkflowRun + WorkflowStepRun 表结构
- [ ] **3.10** 实现工作流引擎核心（解析 YAML、步骤调度、分支控制、超时管理）
- [ ] **3.11** 实现工作流与 Agent 的集成（Skill 注入 → Agent 执行 → 结果收集）
- [ ] **3.12** 实现人工输入节点（WebSocket 推送输入请求 → 等待响应 → 校验 → 继续）
- [ ] **3.13** 工作流管理 API（CRUD + 执行 + 状态查询）
- [ ] **3.14** 前端工作流管理页面（YAML 编辑器 + 可视化流程图）
- [ ] **3.15** 前端会话中工作流悬浮面板（启动、进度、人工输入表单）
- [ ] **3.16** 工作流执行历史与日志查看

---

## 需求4: 用户自配计算服务器

### 背景分析

**现有沙箱架构：**
- `DockerSandboxService` — 在本地 Docker 创建容器
- `RemoteSandboxService` — 通过 HTTP API 连接远程运行时
- `ProcessSandboxService` — 本地进程模式
- 容器镜像: `ghcr.io/openhands/agent-server:1.14.0-python`
- 默认最多 5 个并发容器，无内存/CPU 限制

**需求理解：**
用户在管理界面填入一台云服务器的 IP 和凭证，之后该用户开启的会话容器就会在那台服务器上创建和运行，而不是在 OpenHands 主服务器上。

### 实现方案

#### 用户操作流程（最简化）

```
用户 → 设置页面 → "添加计算服务器"
    ↓
填写: 服务器IP、SSH端口、SSH用户名、SSH密钥(或密码)
    ↓
点击 "测试连接并初始化"
    ↓
系统自动:
  1. SSH连接测试
  2. 检测/安装 Docker
  3. 拉取 agent-server 镜像
  4. 部署轻量管理Agent（openhands-node-agent）
  5. 连通性测试
    ↓
显示 "服务器就绪" → 用户后续会话自动在该服务器创建容器
```

#### 技术架构

```
OpenHands主服务 ←HTTP→ Node Agent(用户服务器:9090)
                            ↓
                     Docker Engine(用户服务器)
                            ↓
                     agent-server容器(会话沙箱)
```

**Node Agent（轻量管理服务）：**
部署在用户服务器上的小型HTTP服务，提供：
- `POST /start` — 创建并启动容器
- `GET /sessions/{id}` — 获取容器状态
- `POST /stop` — 停止容器
- `POST /pause` / `POST /resume` — 暂停/恢复
- `GET /list` — 列出所有容器
- `GET /health` — 健康检查 + 资源使用情况
- `GET /metrics` — CPU/内存/磁盘指标

这个接口设计与现有 `RemoteSandboxService` 的 API 兼容，可以复用其逻辑。

#### 用户服务器最低要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (Ubuntu 20.04+ / CentOS 7+ / Debian 10+) |
| Docker | 自动安装 (如果没有) |
| 网络 | 能被 OpenHands 主服务访问（端口 9090） |
| 内存 | >= 4GB（建议 8GB+） |
| 磁盘 | >= 20GB 可用空间 |
| SSH | 开放SSH端口，提供有sudo权限的账号 |

#### 自动初始化脚本（系统通过SSH执行）

```bash
# 1. 安装Docker（如果没有）
# 2. 拉取agent-server镜像
# 3. 部署node-agent服务（systemd管理）
# 4. 开放必要端口
# 5. 返回连接信息
```

**服务器数据模型：**
```python
class UserServer:
    id: str
    user_id: str            # 所属用户
    name: str               # 服务器名称（用户自定义）
    host: str               # IP 或域名
    ssh_port: int           # SSH端口，默认22
    ssh_user: str           # SSH用户名
    ssh_key: str            # SSH私钥（加密存储）
    agent_port: int         # Node Agent端口，默认9090
    agent_api_key: str      # Node Agent API Key
    status: str             # online / offline / initializing / error
    docker_version: str     # Docker版本
    resources: dict         # CPU/内存/磁盘信息
    max_containers: int     # 最大容器数
    created_at: datetime
    last_heartbeat: datetime
```

### 关键文件

| 文件 | 说明 |
|------|------|
| `openhands/app_server/sandbox/remote_sandbox_service.py` | 远程沙箱服务（可复用API格式） |
| `openhands/app_server/sandbox/docker_sandbox_service.py` | Docker沙箱服务（参考容器创建逻辑） |
| `openhands/app_server/sandbox/sandbox_models.py` | 沙箱数据模型 |
| `openhands/app_server/config.py` | 服务注入配置 |

### 任务拆分

- [ ] **4.1** 开发 Node Agent 轻量服务（Python/Go，兼容RemoteSandbox API）
- [ ] **4.2** 开发服务器自动初始化脚本（SSH安装Docker + 部署Agent）
- [ ] **4.3** 实现服务器管理 API（`custom/remote_server/`）
- [ ] **4.4** 实现基于用户的沙箱路由（根据用户配置选择在哪台服务器创建容器）
- [ ] **4.5** 服务器心跳检测与状态同步
- [ ] **4.6** 前端服务器管理页面（添加/测试/删除服务器）
- [ ] **4.7** SSH密钥加密存储
- [ ] **4.8** 联调测试（添加服务器 → 创建会话 → 容器在远程服务器运行）

---

## 需求5: 公共服务器 & 容器资源监控

### 背景分析

**现有能力：**
- 沙箱状态: STARTING / RUNNING / PAUSED / ERROR / MISSING
- 沙箱列表 API: `GET /api/v1/sandboxes`
- 无资源监控、无服务器管理

**需要新增：**
- 公共服务器池管理（管理员配置，所有用户共用）
- 服务器级资源监控（CPU/内存/磁盘/网络）
- 容器级资源监控（每个容器的资源占用）
- 监控仪表板UI

### 实现方案

```
管理员 → 添加公共服务器（与需求4共用服务器管理能力）
    ↓
Node Agent 定时上报指标 → OpenHands 存储
    ↓
监控仪表板:
  ├── 服务器列表（IP、状态、CPU/内存/磁盘使用率）
  ├── 容器列表（每台服务器上的容器、状态、资源占用）
  ├── 用户维度（每个用户使用了多少资源）
  └── 告警（服务器离线、资源超限）
```

**监控数据模型：**
```python
class ServerMetrics:
    server_id: str
    cpu_percent: float       # CPU 使用率
    memory_total: int        # 总内存 (bytes)
    memory_used: int         # 已用内存
    disk_total: int          # 总磁盘
    disk_used: int           # 已用磁盘
    containers_running: int  # 运行中容器数
    containers_total: int    # 总容器数
    collected_at: datetime

class ContainerMetrics:
    container_id: str
    server_id: str
    user_id: str             # 所属用户
    conversation_id: str     # 关联会话
    cpu_percent: float
    memory_used: int
    memory_limit: int        # 如设置了限制
    network_rx: int          # 网络接收
    network_tx: int          # 网络发送
    status: str
    created_at: datetime
    collected_at: datetime
```

### 任务拆分

- [ ] **5.1** Node Agent 增加指标采集接口（`GET /metrics`）
- [ ] **5.2** 公共服务器管理 API（管理员专用）
- [ ] **5.3** 指标存储与定时采集服务
- [ ] **5.4** 监控 API（`custom/monitoring/`）
- [ ] **5.5** 前端监控仪表板（服务器概览、容器列表、资源图表）
- [ ] **5.6** 容器资源限制配置（可选：设置容器内存/CPU上限）
- [ ] **5.7** 告警功能（服务器离线通知）

---

## 开发优先级建议

| 优先级 | 需求 | 原因 |
|--------|------|------|
| P0 | 需求3A: Skill 管理与版本控制 | 核心业务功能，工作流依赖 Skill |
| P0 | 需求3B: 工作流引擎 + 长任务 | 核心差异化功能，UI 交互核心 |
| P1 | 需求4: 用户自配服务器 | 核心基础设施 |
| P1 | 需求5: 资源监控 | 与需求4紧密相关，可一起开发 |
| P1 | 需求2A: 用户管理 | 多用户基础 |
| P2 | 需求1: SSO登录 | 优先级降低，可先用简单认证过渡 |
| P2 | 需求2B: 会话协作 | 复杂度最高，建议最后做 |

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端框架 | FastAPI (已有) |
| 数据库 | SQLite (开发) → PostgreSQL (生产建议) |
| ORM | SQLAlchemy + Alembic (已有) |
| 前端框架 | React 19 + TypeScript (已有) |
| 状态管理 | Zustand + TanStack Query (已有) |
| UI组件库 | HeroUI + Tailwind CSS (已有) |
| WebSocket | Socket.io (已有) |
| 容器管理 | Docker SDK for Python (已有) |
| SSH管理 | paramiko 或 asyncssh (新增) |
| 监控图表 | recharts 或 @tremor/react (新增) |

---

## 上游同步流程

```bash
# 初始设置（一次性）
git remote add upstream https://github.com/OpenHands/OpenHands.git

# 定期同步
git fetch upstream
git checkout main
git merge upstream/main
# 解决冲突（冲突应该很少，因为我们主要新增文件）
git push origin main
```

---

## 现有系统架构备忘

### 数据库

**当前**: SQLite (`~/.openhands/openhands.db`)，可切换 PostgreSQL

**OSS 版已有表（7个）：**
| 表名 | 用途 |
|------|------|
| `conversation_metadata` | 会话元数据（标题、仓库、分支、模型、成本等） |
| `app_conversation_start_task` | 会话启动任务状态跟踪 |
| `v1_remote_sandbox` | 远程沙箱记录 |
| `pending_messages` | 待处理消息队列 |
| `event_callback` | 事件回调注册 |
| `event_callback_result` | 事件回调执行结果 |

**数据存储分布：**
| 数据类型 | 存储方式 | 位置 |
|----------|----------|------|
| 用户设置 | JSON 文件 | `~/.openhands/settings.json` |
| 用户密钥 | JSON 文件 | `~/.openhands/secrets.json` |
| 会话元数据 | 数据库 | `conversation_metadata` 表 |
| 会话事件/历史 | JSON 文件 | `~/.openhands/sessions/{id}/events/` |
| Agent 状态 | Pickle 文件 | `~/.openhands/sessions/{id}/agent_state.pkl` |
| Skill 定义 | Markdown 文件 | `skills/`, `.openhands/skills/` |

### Agent 执行机制

```
用户发消息 → App Server → Agent Server(容器内)
    ↓
Agent 执行循环:
  1. 构建消息历史 (含 Skill 上下文)
  2. 调用 LLM (带工具定义)
  3. LLM 返回 Action (bash/python/file_edit/browse/...)
  4. 执行 Action → 获得 Observation
  5. 记录事件 → 推送 WebSocket
  6. 检查迭代/预算限制
  7. 回到步骤1，直到 AgentFinishAction 或达到限制
```

**控制参数：**
- `max_iterations`: 最大迭代次数（无默认硬限制，可设很大）
- `max_budget_per_task`: 最大预算(USD)
- 无 wall-clock 超时（理论支持 24h+）
- Condenser 自动压缩历史防止上下文溢出

### Git 仓库配置

```
origin   → https://github.com/yizeng1100-dot/hiclaw.git (我们的私有仓)
upstream → https://github.com/OpenHands/OpenHands.git (官方上游)
```

---

## 待确认事项

- [ ] 公司 SSO 类型和接口文档（优先级已降低）
- [x] GitHub 私有仓库地址 → `https://github.com/yizeng1100-dot/hiclaw.git`
- [ ] 会话协作的具体交互方式（实时协作 vs 轮流操作）
- [ ] 容器资源限制的默认值（内存上限、CPU核数）
- [ ] 监控数据保留时长
- [ ] 工作流定义格式是否需要可视化编辑器（还是纯 YAML 编辑）
- [ ] Skill 版本对比的具体评价维度（成功率、执行时间、输出质量？）
