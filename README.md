# 劳动争议 AI 分析工具

面向律师的劳动争议案件焦点分析工具。上传案件材料（PDF / DOCX），AI 自动识别争议焦点、引用法条、提示风险，律师提交反馈评分。

> **验证版**：目标用户 ≤ 20 名种子律师，使用周期 2–4 周，用于验证产品市场契合度。

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| LLM | OpenAI SDK（默认接 DeepSeek，改 env 切换 provider） |
| 数据库 | SQLite + better-sqlite3 |
| 文件解析 | pdf-parse + mammoth（不支持 OCR） |
| 校验 | zod |
| 容器 | Docker + Docker Compose |

---

## 快速启动

**前置要求：** Docker Desktop（不需要在宿主机安装 Node.js / pnpm）

```bash
# 1. 复制环境变量并填写 API Key
cp .env.local.example .env.local
# 编辑 .env.local，填入 LLM_API_KEY

# 2. 创建数据目录并启动
mkdir -p data
docker compose up -d --build

# 3. 初始化数据库
docker compose exec app pnpm db:init

# 4. 生成第一个邀请链接
docker compose exec app pnpm tsx scripts/invite.ts --email you@example.com --name "你的名字"
# 输出: http://localhost:3000/?t=<token>
```

浏览器打开输出的链接即可使用。

> **注意**：修改 `.env.local` 后必须用 `docker compose up -d --force-recreate` 重建容器，`restart` 不会重新加载 env 文件。

---

## 环境变量

`.env.local`（参考 `.env.local.example`）：

```env
# LLM（默认 DeepSeek，改以下 4 个变量即可切换 provider）
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.deepseek.com/v1

# 应用
DATABASE_PATH=/app/data/legal-ai.db
INVITE_SECRET=           # openssl rand -base64 32
BASE_URL=http://localhost:3000
```

### 切换 LLM Provider（无需改代码）

| Provider | LLM_PROVIDER | LLM_MODEL | LLM_BASE_URL |
|----------|--------------|-----------|--------------|
| DeepSeek（默认） | `deepseek` | `deepseek-v4-flash` | `https://api.deepseek.com/v1` |
| 通义千问 | `qwen` | `qwen-max` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 | `zhipu` | `glm-4-plus` | `https://open.bigmodel.cn/api/paas/v4` |
| Moonshot | `moonshot` | `moonshot-v1-128k` | `https://api.moonshot.cn/v1` |

---

## 常用命令

```bash
# 查看日志
docker compose logs -f app

# 进入容器
docker compose exec app sh

# 生成邀请链接
docker compose exec app pnpm tsx scripts/invite.ts --email user@law.com --name "张律师"

# 运行测试（18 个用例）
docker compose exec app pnpm test

# 查询反馈数据
docker compose exec app node -e "
  const db = require('better-sqlite3')('/app/data/legal-ai.db');
  const rows = db.prepare('SELECT llm_model, COUNT(*) as n, ROUND(AVG(rating),2) as avg FROM feedback GROUP BY llm_model').all();
  console.table(rows);
  db.close();
"

# 每周数据备份
docker compose exec app node -e "
  const db = require('better-sqlite3')('/app/data/legal-ai.db');
  console.log(db.prepare('.dump').all());
" 2>/dev/null || docker compose exec app sh -c "sqlite3 /app/data/legal-ai.db .dump" > backup-$(date +%Y%m%d).sql

# 停止
docker compose down
```

---

## 项目结构

```
app/
  page.tsx                  # 单页（输入 → 分析结果 → 反馈，三段式）
  api/
    analyze/route.ts        # POST：解析文件 → 调 LLM → 写库 → 返回结果
    feedback/route.ts       # POST：提交评分和评论
    health/route.ts         # GET：健康检查（公开，无需 token）
components/
  InputSection.tsx          # 角色单选、城市下拉、文件上传、补充说明
  ResultSection.tsx         # 案情摘要 + 争议焦点卡片列表
  DisputePointCard.tsx      # 单个焦点：观点、证据、法条、风险提示
  FeedbackForm.tsx          # 5 星评分 + 必填评论
lib/
  schema.ts                 # zod schema（LLM 输出结构）
  parsers.ts                # PDF / DOCX 文本提取
  db.ts                     # SQLite 连接 + 增删查封装
  llm.ts                    # OpenAI 客户端（env 配置）
  prompts.ts                # 系统 prompt 模板
scripts/
  schema.sql                # 建表 SQL（users / submissions / feedback）
  db-init.ts                # 初始化数据库
  invite.ts                 # 生成邀请链接
middleware.ts               # token 格式校验（Edge runtime）
```

---

## 访问控制

无注册/登录。通过邀请链接访问：

1. 运行 `scripts/invite.ts` 生成带 token 的 URL
2. 律师点击链接，token 写入 cookie（30 天有效）
3. middleware 校验 token 格式；API routes 验证 token 对应的用户记录

---

## 测试

```bash
docker compose exec app pnpm test
```

覆盖范围：`lib/schema`（4）、`lib/parsers`（4）、`lib/db`（5）、`/api/analyze`（3）、`/api/feedback`（2），共 **18 个用例**。

UI 组件不写自动化测试，见手动测试清单（`mvp_requirements.md` 第 9.3 节）。

---

## 部署

**选项 A（推荐）：本机 + Cloudflare Tunnel**

```bash
docker compose -f docker-compose.prod.yml up -d
cloudflared tunnel --url http://localhost:3000
```

**选项 B：阿里云 HK ECS**

```bash
# 本地构建 amd64 镜像并传输
docker buildx build --platform linux/amd64 -t legal-ai:prod --target prod --load .
docker save legal-ai:prod | gzip > legal-ai.tar.gz
scp legal-ai.tar.gz root@<hk-ecs>:/root/

# ECS 上启动
ssh root@<hk-ecs>
docker load < legal-ai.tar.gz
docker compose -f docker-compose.prod.yml up -d
```
