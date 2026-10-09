<div align="center">

# AlphaStarNote

**阿尔法星笔记 — 基于 KG + LLM 融合推理的智能笔记与可视化平台**

多端知识管理 · 融合推理 · 知识图谱可视化 · 活跃社区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg)](https://fastapi.tiangolo.com/)

</div>

---

## 这是什么

AlphaStarNote 是一款自托管的智能笔记应用：上传多模态资料（PDF、网页、音视频等），自动提取、向量化、建立知识图谱，然后基于图谱与 LLM 的**融合推理**来问答、生成笔记、产出播客与可视化图表。

与纯向量检索方案不同，本项目在检索层同时利用**知识图谱结构**与**语义向量**，让回答既能命中语义相近的内容，也能沿实体关系做多跳推理 —— 这是"KG + LLM 融合推理"的核心。

## 与上游的关系

本项目是基于开源项目 **[open-notebook](https://github.com/lfnovo/open-notebook)**（作者 Luis Novo，MIT 许可）的二次开发分支，在上游基础上做了面向产品化的定制（见下方[与上游的差异](#与上游的差异)）。

- 上游仓库：https://github.com/lfnovo/open-notebook
- 上游文档：本仓库 `docs/` 目录保留了上游完整文档（安装、配置、AI 供应商等），大部分内容对本项目仍然适用
- 许可证：沿用 MIT，上游版权声明完整保留于 [LICENSE](LICENSE)

## 核心功能

| 功能 | 说明 |
|---|---|
| **多模态资料导入** | 支持 50+ 文件类型与网页链接，自动抽取正文与元数据 |
| **KG + LLM 融合推理** | 知识图谱结构与语义向量联合检索，支持多跳推理 |
| **语义搜索** | SurrealDB 内置向量检索，跨全部资料 |
| **对话问答** | 基于 LangGraph 的多轮对话，可指定资料来源范围 |
| **智能笔记与转换** | 自定义 Transformation 提示词，批量生成结构化笔记 |
| **播客生成** | 从资料自动生成双人对谈播客（异步任务队列） |
| **多 AI 供应商** | 通过 Esperanto 统一接入 OpenAI、Anthropic、Google、Groq、Mistral、DeepSeek、xAI、Ollama 等 |
| **多租户与鉴权** | 独立账号体系，资料按用户隔离（见下） |

## 与上游的差异

本项目相对上游的主要定制：

### 1. 多租户鉴权体系

上游仅有开发用的简单口令中间件；本项目实现了完整的自有账号体系：

- JWT 账号认证（`api/auth.py`、`api/routers/auth.py`）
- 用户表与角色模型，支持 `member` / 管理员角色（`api/user_db.py`、`api/user_manager.py`）
- 管理后台接口（`api/routers/admin.py`）
- 数据库迁移 **14 / 15 / 16**：新增 `user` 表，并为核心业务表（`notebook`、`source`、`note`、`chat_session`）加上 `owner` 字段与索引，实现按用户的数据隔离
- 历史数据归属迁移脚本：`scripts/migrate_owners.py`

相关环境变量（前缀 `ALPHA_NOTE_`）：`ALPHA_NOTE_JWT_SECRET`、`ALPHA_NOTE_ADMIN_EMAIL`、`ALPHA_NOTE_ADMIN_PASSWORD`、`ALPHA_NOTE_REGISTRATION_MODE`。

### 2. 交互网课内嵌

在笔记页内嵌交互式网课生成能力（`api/routers/interactive_classroom.py` + 前端 `InteractiveClassroomPanel`）：

- 基于笔记内容提交网课生成任务，走**异步任务 + 轮询**模式（默认对接 `https://open.maic.chat`，可用 `OPENMAIC_BASE_URL` 覆盖）
- 生成结果中的 drawio 图表会被解析并注入笔记（`<!-- drawio:start -->` / `<!-- drawio:end -->` 块）

### 3. 部署与跨平台修复

- `Dockerfile` / `supervisord.conf` / `scripts/wait-for-api.sh` 的启动流程修复
- 修复了交互网课任务轮询的超时误判

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│           前端  Next.js 16 (React 19)               │
│                   :3000                             │
│  Zustand · TanStack Query · Tailwind · shadcn/ui    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP REST（开发期经 /api/* 代理）
┌───────────────────────▼─────────────────────────────┐
│              后端  FastAPI                          │
│                   :5055                             │
│  LangGraph 工作流 · Esperanto 多供应商 · surreal-commands │
└───────────────────────┬─────────────────────────────┘
                        │ SurrealQL
┌───────────────────────▼─────────────────────────────┐
│          数据库  SurrealDB                          │
│                   :8000                             │
│  图数据 + 向量索引 · 启动时自动迁移                  │
└─────────────────────────────────────────────────────┘
```

- **后端**：Python 3.11+ / FastAPI / Pydantic v2 / Loguru；工作流用 LangGraph；AI 供应商经 Esperanto 统一接入；异步任务用 surreal-commands
- **前端**：Next.js 16 + TypeScript，Webpack(Turbopack) 构建，i18n 兼容（改动需同步翻译键）
- **数据库**：SurrealDB 图数据库，API 启动时由 `AsyncMigrationManager` 自动执行迁移

## 快速开始

### 前置要求

- Docker（跑数据库）
- Python 3.11 或 3.12
- Node.js 20+
- [uv](https://docs.astral.sh/uv/)（可选，用于依赖管理）

### 1. 启动数据库

```bash
docker compose up -d surrealdb
```

### 2. 配置环境变量

复制模板并修改。**注意数据库地址**：若 API 在宿主机直跑（非容器内），必须用 `localhost`：

```bash
cp docker.env.example .env
```

`.env` 关键项：

```ini
# 必填：加密数据库中存储的 API 密钥
OPEN_NOTEBOOK_ENCRYPTION_KEY=change-me-to-a-secret-string
# 必填：JWT 签名密钥（生产环境务必改成强随机串）
ALPHA_NOTE_JWT_SECRET=change-me-to-a-jwt-secret
# 首次启动自动创建的管理员账号
ALPHA_NOTE_ADMIN_EMAIL=admin@localhost
ALPHA_NOTE_ADMIN_PASSWORD=changeme
ALPHA_NOTE_REGISTRATION_MODE=open

# API 直跑时用 localhost；docker compose 内跑则用 surrealdb
SURREAL_URL=ws://localhost:8000/rpc
SURREAL_USER=root
SURREAL_PASSWORD=root
SURREAL_NAMESPACE=open_notebook
SURREAL_DATABASE=open_notebook
```

> `.env` 已被 `.gitignore` 忽略，不会被提交。

### 3. 安装依赖

```bash
uv sync                     # 或 pip install -e .
cd frontend && npm install && cd ..
```

### 4. 启动 API

```bash
uv run run_api.py           # 或 .venv/Scripts/python run_api.py (Windows)
```

首次启动会自动执行数据库迁移。看到 `API initialization completed successfully` 即为就绪，验证：

```bash
curl http://localhost:5055/health     # {"status":"healthy"}
```

接口文档：http://localhost:5055/docs

### 5. 启动后台 worker

处理嵌入、播客等异步任务（不启动则相关功能会一直排队）：

```bash
uv run surreal-commands-worker --import-modules commands
```

> **Windows 用户必读**：该 worker 会通过 rich 打印含 emoji 的日志，在 GBK 代码页下会直接崩溃（`UnicodeEncodeError: 'gbk' codec can't encode character '✅'`）。必须加 UTF-8 模式启动：
>
> ```bash
> PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run surreal-commands-worker --import-modules commands
> ```

### 6. 启动前端

```bash
cd frontend && npm run dev
```

打开 **http://localhost:3000** —— 这就是应用首页（会自动跳转到 `/notebooks`）。

### 端口一览

| 端口 | 服务 | 用途 |
|---|---|---|
| **3000** | Next.js 前端 | 浏览器访问入口 |
| 5055 | FastAPI 后端 | REST API 与 `/docs` |
| 8000 | SurrealDB | 数据库（内部使用） |

## 目录结构

```
├── api/                    # FastAPI 层：路由、服务、模型、鉴权
│   ├── routers/            # 各业务路由（notebooks/notes/chat/podcasts/...）
│   ├── auth.py             # JWT 鉴权与中间件
│   ├── user_db.py          # 用户表访问
│   └── user_manager.py     # 用户管理逻辑
├── open_notebook/          # 核心领域层
│   ├── domain/             # 数据模型与仓储
│   ├── graphs/             # LangGraph 工作流
│   ├── ai/                 # ModelManager / 供应商适配
│   └── database/migrations # SurrealQL 迁移脚本
├── frontend/               # Next.js 前端
│   └── src/
│       ├── app/            # App Router 页面
│       ├── components/     # UI 组件
│       └── lib/            # API 客户端、hooks、类型
├── commands/               # 异步任务定义
├── docs/                   # 项目文档（继承自上游）
├── scripts/                # 辅助脚本
└── tests/                  # pytest 测试
```

## 开发

```bash
uv run pytest tests/            # 全部测试
cd frontend && npm run lint     # 前端 lint
cd frontend && npm run test     # 前端测试 (vitest)
```

各子模块有独立的 `CLAUDE.md` 提供更详细的架构说明：`api/`、`open_notebook/`、`frontend/` 等。

## 已知问题

- **`make start-all` 不可用**：Makefile 中的 `start-all` / `dev` / `full` 目标依赖 `docker-compose.dev.yml` 与 `docker-compose.full.yml`，这两个文件在本分支中不存在。请按上文"快速开始"手动分组件启动。`stop-all` / `status` 中的 `pkill` / `pgrep` 也是 Linux-only，Windows 下无效。
- **Windows worker 编码问题**：见上文第 5 步的 `PYTHONUTF8` 说明。
- **根目录 `package-lock.json`**：该多余文件会让 Next.js 误判 workspace root 并打印警告，可安全删除。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

原始项目 [open-notebook](https://github.com/lfnovo/open-notebook) 版权归 Luis Novo 所有（Copyright (c) 2024 Luis Novo），本项目在其基础上二次开发，完整保留原始版权声明。
