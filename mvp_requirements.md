# MVP 需求文档：劳动争议 AI 分析工具 v4（验证版）

> 面向 Claude Code 的开发需求 | 定位：**商业假设验证工具**，非可上线产品  
> 主要变更（v4）：砍掉所有非验证必需功能；开发与测试环境统一为 macOS M4 Pro 上的 Docker

---

## 零、版本哲学（重要）

**这不是产品，这是验证工具。** 目标用户不超过 20 名种子律师，使用周期 2-4 周。所有设计决策遵循三条原则：

1. 能用脚本绕过的，不写 UI（如用户管理、案件列表）
2. 能在迭代中追加的，不在第一版做（如 OCR、多 LLM 切换、自动化测试）
3. 能让律师付费的，全力做好（争议焦点分析质量、法条溯源、反馈收集）

**预期开发工作量：1 名全栈 5–8 个工作日。**

代码假设最终会被重写或重构。不要为长期可维护性做权衡。

---

## 一、要验证的商业假设

唯一目标：**确认是否存在律师愿意付费的产品-市场契合点**。具体三个子假设：

| 假设 | 验证信号 |
|------|---------|
| H1：AI 输出对律师有专业价值 | 律师反馈评分 ≥ 4 分（满分 5）的占比 ≥ 60% |
| H2：律师愿意为此付费 | 试用 2 周后明确表示愿付月费 ¥199+ 的律师 ≥ 30% |
| H3：劳动争议是足够垂直的切入点 | 律师反馈"焦点识别准确"的比例 > "焦点遗漏严重"的比例 |

数据库字段、反馈表单、用户运营节奏都围绕这三个假设设计。

---

## 二、技术栈

| 层级 | 选型 | 备注 |
|------|------|------|
| 前端 + 后端 | Next.js 14 (App Router) + TypeScript | 单一应用 |
| 样式 | Tailwind CSS + shadcn/ui | 复制 5–6 个组件即够 |
| LLM | OpenAI SDK + DeepSeek API | 见第四节 |
| 数据库 | SQLite + better-sqlite3 | 单文件，无需独立服务 |
| 文件解析 | pdf-parse + mammoth | **不做 OCR**，图片让律师手动转文字 |
| 校验 | zod | LLM 输出与表单输入 |
| 容器 | Docker + Docker Compose | 全部本地运行 |

**明确不引入：** NextAuth、Drizzle、Redis、S3/MinIO、React Query、Playwright、Vitest、PostgreSQL、Anthropic SDK。

---

## 三、核心功能

整个产品就是**一个页面、一次分析、一次反馈**。

### 3.1 单页流程

```
访问 URL → [输入区] → 点击"开始分析" → [结果区] → [反馈区]
```

**输入区（页面顶部）：**
- 当事人角色单选：代理劳动者 / 代理用人单位
- 争议城市下拉：北京 / 上海 / 广州 / 深圳 / 成都 / 杭州 / 其他
- 文件上传区（拖拽，PDF / DOCX，最多 10 个）
- 案情补充文本框（多行，律师可粘贴微信聊天记录、补充说明等）
- 大按钮"开始分析"

**结果区（替换输入区显示）：**
- 顶部一行小字：案情摘要（2–3 句，AI 自动生成）
- 主体：争议焦点卡片列表（每张卡片包含：标题、我方观点、对方可能论点、关键证据来源、相关法条+条文摘要、风险提示）
- 卡片不需折叠、不需 Tab 切换、不需进度动画——完整加载后一次展示

**反馈区（结果下方）：**
- 5 星评分："这次分析的整体质量"
- 自由文本框（必填）："最有价值的部分 / 最不准确的地方 / 你的建议"
- 提交按钮

提交反馈后页面顶部显示"感谢反馈，可继续上传新案件 →"，点击重置回输入区。

### 3.2 不做的功能（明确清单）

- ❌ 用户注册 / 登录 / 密码（用 URL 邀请 token，详见第六节）
- ❌ 案件列表 / 历史记录页（律师每次都是新案子，看完就走）
- ❌ 案情摘要 Tab、证据清单 Tab、客户报告 Tab（**仅做争议焦点**，证据和客户报告是 v2）
- ❌ 文件标签分类（让 LLM 从内容自动识别文件类型）
- ❌ 律师标注按钮（👍/👎/✏️）→ 简化为一个总评分 + 自由文本
- ❌ 进度分步打勾动画（一个简单 loading 提示即可）
- ❌ Rate Limiting（10–20 个用户，账单监控就够）
- ❌ 案件软删除、用户资料管理
- ❌ OCR 图片识别
- ❌ 邮件通知、忘记密码

---

## 四、LLM 调用

### 4.1 默认配置：DeepSeek V4

DeepSeek 兼容 OpenAI 协议，用 `openai` SDK 一行配置即可。**不写抽象层**——所有 OpenAI 兼容服务（DeepSeek、通义、智谱、Moonshot）只需改 4 个环境变量就能切换：

```typescript
// lib/llm.ts，全部代码不超过 50 行
import OpenAI from 'openai';

export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL,
});

export const LLM_MODEL = process.env.LLM_MODEL!;
export const LLM_PROVIDER = process.env.LLM_PROVIDER!;  // 仅用于日志和数据库记录
```

调用时直接：
```typescript
const response = await llm.chat.completions.create({
  model: LLM_MODEL,
  messages: [...],
  response_format: { type: 'json_object' },
});
```

### 4.2 Provider 切换（无需改代码）

| Provider | LLM_PROVIDER | LLM_MODEL | LLM_BASE_URL |
|----------|--------------|-----------|--------------|
| **DeepSeek（默认）** | `deepseek` | `deepseek-v4` | `https://api.deepseek.com/v1` |
| 通义千问 | `qwen` | `qwen-max` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 | `zhipu` | `glm-4-plus` | `https://open.bigmodel.cn/api/paas/v4` |
| Moonshot | `moonshot` | `moonshot-v1-128k` | `https://api.moonshot.cn/v1` |

### 4.3 System Prompt

```
你是一名专注劳动争议的中国执业律师助理。
基于律师提供的案件材料，输出严格 JSON 格式的分析结果。

约束：
1. 法条引用必须精确，格式《法律名称》第X条 + 条文原文摘要
2. 每个观点必须基于材料，注明来源（如"根据 file_2 劳动合同第8条"）
3. 不确定时标注"材料不足，建议补充"，不得推测
4. 当前代理方：{client_role}
5. 案件所在地：{dispute_city}

输出 JSON 结构：
{
  "summary": "案情简述，2-3 句",
  "dispute_points": [
    {
      "title": "争议焦点标题",
      "our_position": "我方观点（基于代理方）",
      "opposing_arguments": ["对方可能论点1", "..."],
      "key_evidence": ["证据描述（含来源文件）"],
      "applicable_laws": [
        { "citation": "《劳动合同法》第X条", "text": "条文原文摘要" }
      ],
      "risks": "风险提示"
    }
  ]
}
```

### 4.4 输出校验

`lib/schema.ts` 用 zod 定义上述 JSON 结构。LLM 返回后必须经 zod 校验，失败则在数据库保存原始响应（便于事后分析），前端提示"分析异常，请重试"。

### 4.5 Token 处理

- 文件文本拼接前缀 `[文件 N: 文件名.pdf]`
- 总输入超过 100K tokens 时简单截断后部（按字符长度估算，中文 1 字 ≈ 1.5 tokens），不做优先级排序——验证期可接受
- DeepSeek V4 上下文 64K–128K，分析超时设为 180 秒

---

## 五、Middleware

`middleware.ts` 只做一件事：检查 URL 中的 invite token。

```
- 公开路径：/api/health
- 其他所有路径：必须 cookie 或 URL query 中带有效 invite token
- 无效 token → 返回简单 403 页面"链接无效或已过期"
```

不做：rate limiting、安全头、请求日志（开发期看 console，生产期看 Docker logs）。

---

## 六、用户管理（极简）

**无注册、无登录、无密码。** 通过邀请链接验证身份。

### 6.1 流程

1. 你（运营方）通过命令行脚本生成邀请：
   ```bash
   pnpm tsx scripts/invite.ts --email zhang@law.com --name "张律师"
   ```
   输出：`https://app.example.com/?t=abc123xyz`
2. 律师点击链接，前端把 token 存入 localStorage 和 cookie
3. 后续访问自动携带，无需再次输入

### 6.2 数据库 `users` 表

```sql
CREATE TABLE users (
  token TEXT PRIMARY KEY,            -- nanoid(16)
  email TEXT,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_active_at INTEGER
);
```

总共 1 张用户表 + 2 张业务表，详见第七节。

---

## 七、数据库设计（SQLite）

```sql
-- 用户（邀请制）
CREATE TABLE users (
  token TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_active_at INTEGER
);

-- 提交（每次律师点"开始分析"产生一条记录）
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,                    -- nanoid(12)
  user_token TEXT NOT NULL REFERENCES users(token),
  client_role TEXT NOT NULL,              -- employee | employer
  dispute_city TEXT,
  raw_text TEXT NOT NULL,                 -- 拼接后的所有材料文本
  file_metadata TEXT,                     -- JSON: [{name, type, size}]
  analysis_result TEXT,                   -- JSON: 完整 LLM 响应（即使校验失败也存）
  parse_status TEXT NOT NULL,             -- success | failed
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  duration_ms INTEGER,                    -- 分析耗时
  created_at INTEGER DEFAULT (unixepoch())
);

-- 反馈（律师对每次分析的评价）
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  user_token TEXT NOT NULL REFERENCES users(token),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  llm_provider TEXT NOT NULL,             -- 与 submission 一致，冗余便于聚合统计
  llm_model TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_submissions_user ON submissions(user_token);
CREATE INDEX idx_feedback_submission ON feedback(submission_id);
CREATE INDEX idx_feedback_model ON feedback(llm_provider, llm_model);
```

**为什么保留 `llm_provider` 和 `llm_model`：** 验证期可能会切换 DeepSeek/通义/智谱比较输出质量，反馈数据必须能按模型分组聚合，否则验证假设 H1 时数据是混的。

**SQLite 文件位置：** `/app/data/legal-ai.db`，通过 Docker volume 持久化到宿主机 `./data/`。

---

## 八、环境变量

`.env.local`（开发）/ `.env.production`（部署）：

```env
# LLM
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com/v1

# 应用
DATABASE_PATH=/app/data/legal-ai.db
INVITE_SECRET=                    # openssl rand -base64 32
NODE_ENV=development              # production
PORT=3000
```

---

## 九、开发与测试环境（macOS M4 Pro + Docker）

**核心约束：** 不在 Mac 上直接安装 Node.js / pnpm，所有运行时都在 Docker 容器内。这样开发、测试、部署用同一份镜像，避免环境差异。

### 9.1 Docker Compose 配置

`docker-compose.yml`（开发）：

```yaml
services:
  app:
    build:
      context: .
      target: dev
    platform: linux/arm64                # M4 Pro 原生
    ports:
      - "3000:3000"
    volumes:
      - ./:/app                          # 源码热挂载
      - /app/node_modules                # 隔离 node_modules（避免 macOS 路径覆盖容器）
      - ./data:/app/data                 # SQLite 文件持久化
    env_file: .env.local
    command: pnpm dev
    restart: unless-stopped
```

`Dockerfile`（多阶段，dev + prod 共用）：

```dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++  # better-sqlite3 编译需要
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 9.2 日常开发命令

```bash
# 首次启动
mkdir -p data
docker compose up -d --build
docker compose exec app pnpm db:init      # 执行 schema.sql 创建表

# 进入容器执行命令
docker compose exec app sh
docker compose exec app pnpm tsx scripts/invite.ts --email test@test.com

# 查看日志
docker compose logs -f app

# 重启
docker compose restart app

# 停止 + 清理
docker compose down
```

### 9.3 测试（手动为主）

**没有自动化测试。** 验证期代码可能频繁改动，写测试 ROI 极低。

**手动测试清单**（每次重要修改后跑一遍，约 15 分钟）：

```
1. 生成邀请链接 → 浏览器访问 → 验证 token 存入 localStorage
2. 上传 1 PDF + 1 DOCX → 点击分析 → 等待返回
3. 验证争议焦点至少 2 条，每条含法条引用
4. 点击复制按钮 → 验证内容到剪贴板
5. 提交反馈 → 进入 SQLite 查表验证数据写入
   docker compose exec app sqlite3 /app/data/legal-ai.db \
     "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 1;"
6. 切换 LLM_PROVIDER 为 qwen，重启容器，重复步骤 2 → 验证可切换
```

**部署前必跑：**
- 用 3 份真实劳动争议案件材料完整跑通流程
- 人工评估 LLM 输出质量（这是验证 H1 的关键）

### 9.4 数据导出（验证期数据分析）

每周导出一次 SQLite 数据用于分析：

```bash
docker compose exec app sqlite3 /app/data/legal-ai.db .dump > backup-$(date +%Y%m%d).sql
```

或者用 SQL 直接出验证报告：

```sql
-- 验证 H1：律师反馈质量
SELECT
  llm_model,
  COUNT(*) as total,
  ROUND(AVG(rating), 2) as avg_rating,
  SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as pct_4plus
FROM feedback
GROUP BY llm_model;
```

### 9.5 macOS M4 Pro 已知坑

- **better-sqlite3 ARM64 编译**：必须在 Dockerfile 里安装 `python3 make g++`，否则原生模块编译失败
- **不要用 `--platform=linux/amd64`** 跑容器，会触发 Rosetta 转译，性能下降 5–10 倍
- **Volume 挂载性能**：macOS Docker 的 bind mount 性能不如原生 Linux。如果热更新慢，把 `node_modules` 用命名卷而不是 bind mount（`docker-compose.yml` 已配置）
- **Docker Desktop 设置**：分配至少 4GB 内存、2 CPU；启用 VirtioFS（设置 → General → VirtioFS）能显著提升 volume 性能

---

## 十、部署

**MVP 阶段不需要"标准部署"。** 提供两个轻量选项，按种子用户网络环境二选一：

### 选项 A：从开发 Mac 直接对外（推荐）

适合：种子用户都在国内、Mac 不关机、迭代频繁。

```bash
# 1. 启动应用（生产模式）
docker compose -f docker-compose.prod.yml up -d

# 2. 用 Cloudflare Tunnel 暴露公网（免费、免备案、无需公网 IP）
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
# 输出一个 https://xxx.trycloudflare.com 临时域名
```

**注意：** Cloudflare 在国内某些运营商网络下偶尔不稳。如果种子律师反映访问慢，切换到选项 B。

### 选项 B：阿里云 HK 区一台 ECS

适合：种子用户网络环境差异大、需要稳定访问。

- 资源：阿里云 HK 2核2G ECS（~¥80/月，无需 ICP 备案）
- 部署流程：
  ```bash
  # macOS 上构建 amd64 镜像（HK ECS 是 x86_64）
  docker buildx build --platform linux/amd64 -t legal-ai:prod --target prod --load .
  docker save legal-ai:prod | gzip > legal-ai.tar.gz
  scp legal-ai.tar.gz root@hk-ecs:/root/
  
  # ECS 上加载并启动
  ssh root@hk-ecs
  docker load < legal-ai.tar.gz
  docker compose -f docker-compose.prod.yml up -d
  ```
- 反向代理：用 Caddy（比 Nginx 简单一半）：
  ```
  app.yourdomain.com {
    reverse_proxy localhost:3000
    request_body { max_size 25MB }
  }
  ```
  Caddy 自动签发 HTTPS，零配置。

### 不做的部署相关事项

- ❌ ICP 备案（HK 区不需要；选项 A 用 Cloudflare 临时域名）
- ❌ 阿里云 RDS / Redis / OSS（SQLite + 本地文件足够 20 用户）
- ❌ ACR 镜像仓库（直接 `docker save / load` 传镜像）
- ❌ CI/CD pipeline（手动 `docker compose up -d` 即可）
- ❌ 监控告警（Docker logs 看错误就行）

---

## 十一、验收标准

1. ✅ 邀请脚本能生成可用链接，律师点击后无需任何登录操作即可使用
2. ✅ 上传 PDF + DOCX → 触发 DeepSeek 分析 → 返回结构化争议焦点（≥ 2 条，含法条溯源）
3. ✅ 反馈表单提交后数据写入 `feedback` 表
4. ✅ 改 `.env.local` 切换 `LLM_PROVIDER` 至 `qwen` / `zhipu` 后重启容器，分析功能仍正常
5. ✅ Docker Compose 在 macOS M4 Pro 上一键启动，无 ARM64 兼容问题
6. ✅ Cloudflare Tunnel 或 HK ECS 任一方案部署成功，种子律师可访问
7. ✅ 用 3 份真实劳动争议材料人工评估，至少 2 份输出"专业律师认可"

---

## 十二、项目结构

```
/
├── app/
│   ├── page.tsx                 # 唯一页面（输入+结果+反馈三段式）
│   ├── layout.tsx
│   └── api/
│       ├── analyze/route.ts     # POST: 触发分析
│       ├── feedback/route.ts    # POST: 提交反馈
│       └── health/route.ts      # GET: 健康检查
├── components/
│   ├── ui/                      # shadcn/ui（Button、Card、Textarea、Select、RadioGroup、Toast）
│   ├── InputSection.tsx
│   ├── ResultSection.tsx
│   ├── FeedbackForm.tsx
│   └── DisputePointCard.tsx
├── lib/
│   ├── llm.ts                   # DeepSeek 客户端配置
│   ├── prompts.ts               # System prompt 模板
│   ├── schema.ts                # zod 输出 schema
│   ├── db.ts                    # SQLite 连接 + 查询封装
│   └── parsers.ts               # PDF + DOCX 文本提取
├── scripts/
│   ├── invite.ts                # 生成邀请链接
│   ├── schema.sql               # 建表 SQL
│   └── db-init.ts               # 执行 schema.sql
├── data/
│   └── legal-ai.db              # SQLite 数据文件（gitignore）
├── middleware.ts
├── docker-compose.yml           # 开发
├── docker-compose.prod.yml      # 部署
├── Dockerfile                   # 多阶段（dev + prod）
├── .env.local.example
├── tailwind.config.ts
├── next.config.js               # output: 'standalone' + serverExternalPackages
└── package.json
```

预计代码总量：**1500–2500 行（含 UI），不超过 v3 的 1/4**。

---

## 十三、给 Claude Code 的开发指令

阅读本文档后按以下顺序实施：

1. **基础设施先跑通**
   - 初始化 Next.js 项目，配 Tailwind + shadcn/ui
   - 写 Dockerfile + docker-compose.yml，`docker compose up -d --build` 在 M4 Pro 上跑通
   - 写 schema.sql 和 db-init 脚本，验证 SQLite 文件创建成功

2. **LLM 调用先跑通**
   - 写 `lib/llm.ts`、`lib/prompts.ts`、`lib/schema.ts`
   - 写一个临时的 CLI 脚本 `scripts/test-llm.ts`，从命令行传入文本，调 DeepSeek，打印结构化输出
   - 验证 zod 校验通过，再继续

3. **核心 API 先跑通**
   - `/api/analyze`：接收 FormData（文件 + 文本 + 当事人角色 + 城市）→ 解析文件 → 调 LLM → 写入 `submissions` 表 → 返回结果
   - `/api/feedback`：接收评分 + 评论 → 写入 `feedback` 表
   - 用 curl 或 Postman 验证两个 API 工作正常

4. **UI 最后做**
   - `app/page.tsx` 单页三段式
   - 文件上传用 `react-dropzone`，结果用卡片展示
   - 不做加载动画，简单文字提示即可

5. **邀请脚本和部署**
   - `scripts/invite.ts` 生成 token，插入 users 表，输出 URL
   - 选 Cloudflare Tunnel 方案，一行命令暴露公网

每完成一步告知验收，再继续下一步。

---

## 十四、什么时候升级到 v5（产品化）

**当下面任一条件满足时，本验证版生命周期结束**，需要重新规划产品化版本（v5 = 接近 v3 的工程标准）：

- 付费用户数 ≥ 5 个，月稳定收入 ≥ ¥1000
- 单日活跃用户 ≥ 10 个
- 任意一份反馈表显示律师在用本工具处理对外正式案件（说明已超出验证场景）

升级时需要补的功能（从 v3 文档继承）：
- 真正的认证体系（NextAuth）
- PostgreSQL + 对象存储
- 多 LLM provider 抽象层 + 切换面板
- 案件历史 / 列表
- Tab C 证据清单 + Tab D 客户报告
- 自动化测试 + CI/CD
- 阿里云正式部署 + ICP 备案

---

*文档结束。这是验证工具，不是产品。当你写代码犹豫"要不要做得更鲁棒一点"时，答案是不要。*
