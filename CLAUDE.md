# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **validation-phase MVP** for a Chinese labor dispute AI analysis tool targeting ~20 seed lawyers for 2–4 weeks. The goal is to validate product-market fit, not build a production product. Code is expected to be rewritten. Do not add robustness, abstractions, or features beyond what is explicitly specified.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript — single application
- **Styling**: Tailwind CSS + shadcn/ui
- **LLM**: OpenAI SDK pointing at DeepSeek API (compatible interface — swap provider via env vars, no code changes)
- **Database**: SQLite via `better-sqlite3` — single file at `/app/data/legal-ai.db`
- **File parsing**: `pdf-parse` + `mammoth` (no OCR)
- **Validation**: `zod` for both LLM output and form input
- **Runtime**: Docker only — do not install Node.js or pnpm directly on macOS

## Development Commands

All commands run inside the Docker container. The source directory is bind-mounted at `/app`.

```bash
# First-time setup
mkdir -p data
docker compose up -d --build
docker compose exec app pnpm db:init       # runs scripts/schema.sql to create tables

# Daily development — IMPORTANT: use up --force-recreate (not restart) to reload .env.local
docker compose up -d --force-recreate      # picks up env changes
docker compose logs -f app                 # tail logs (replaces devtools)
docker compose down                        # stop everything

# Container shell
docker compose exec app sh

# Generate invite link for a seed lawyer
docker compose exec app pnpm tsx scripts/invite.ts --email zhang@law.com --name "张律师"

# Query SQLite directly
docker compose exec app sqlite3 /app/data/legal-ai.db "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 5;"

# Weekly data export
docker compose exec app sqlite3 /app/data/legal-ai.db .dump > backup-$(date +%Y%m%d).sql
```

## Architecture

Single-page application with three sequential sections: input → result → feedback.

```
app/
  page.tsx                  # single page, three-section layout
  layout.tsx
  api/
    analyze/route.ts        # POST: parse files → call LLM → write submissions table → return JSON
    feedback/route.ts       # POST: write feedback table
    health/route.ts         # GET: public health check
components/
  InputSection.tsx          # client role radio, city select, file dropzone, supplement text
  ResultSection.tsx
  FeedbackForm.tsx          # 5-star rating + required comment
  DisputePointCard.tsx
  ui/                       # shadcn/ui primitives (Button, Card, Textarea, Select, etc.)
lib/
  llm.ts                    # OpenAI client configured from env vars
  prompts.ts                # system prompt template
  schema.ts                 # zod schema for LLM JSON output
  db.ts                     # SQLite connection + query helpers
  parsers.ts                # PDF + DOCX text extraction
scripts/
  invite.ts                 # generate nanoid token, insert into users, print URL
  schema.sql                # CREATE TABLE statements
  db-init.ts                # runs schema.sql
middleware.ts               # invite token check on all paths except /api/health
```

## LLM Integration

`lib/llm.ts` — fewer than 50 lines. The client is configured entirely from env vars:

```typescript
import OpenAI from 'openai';
export const llm = new OpenAI({ apiKey: process.env.LLM_API_KEY!, baseURL: process.env.LLM_BASE_URL });
export const LLM_MODEL = process.env.LLM_MODEL!;
export const LLM_PROVIDER = process.env.LLM_PROVIDER!;
```

Always use `response_format: { type: 'json_object' }`. Validate the response with zod. On validation failure, save the raw LLM response to `submissions.analysis_result` and return an error to the frontend — never silently swallow parse failures.

Token budget: prepend `[文件 N: filename]` to each file's text. If total input exceeds ~100K tokens (estimate: 1 Chinese char ≈ 1.5 tokens), truncate from the end. LLM timeout: 180 seconds.

## Database Schema

Three tables — `users`, `submissions`, `feedback`. See `scripts/schema.sql` for full DDL. Key design note: `llm_provider` and `llm_model` are stored redundantly on both `submissions` and `feedback` to enable per-model quality aggregation when validating hypothesis H1.

## Authentication

No login system. Invite-only via URL token (`?t=<nanoid16>`). `middleware.ts` validates the token against the `users` table on every request except `/api/health`. The frontend stores the token in both `localStorage` and a cookie for subsequent requests.

## Environment Variables

Copy `.env.local.example` to `.env.local`. Required vars:

```
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com/v1
DATABASE_PATH=/app/data/legal-ai.db
INVITE_SECRET=       # openssl rand -base64 32
```

Switching providers requires only changing these four vars and restarting the container — no code changes.

## Docker Notes (macOS M4 Pro)

- Always use `platform: linux/arm64` — never `linux/amd64` (Rosetta degrades performance 5–10×)
- `better-sqlite3` requires native compilation: the Dockerfile must install `python3 make g++` in the Alpine base
- `node_modules` must be in a named volume, not a bind mount, to prevent macOS paths from overwriting container paths
- Enable VirtioFS in Docker Desktop for better bind mount performance

## Testing

No automated tests. Manual test checklist (run after each significant change, ~15 min):

1. Generate invite link → browser visit → verify token in localStorage
2. Upload 1 PDF + 1 DOCX → analyze → result has ≥2 dispute points with law citations
3. Submit feedback → verify row in `feedback` table via sqlite3
4. Change `LLM_PROVIDER` to `qwen`, restart container, repeat step 2

Before any deployment: run 3 real labor dispute case files through the full flow and manually assess output quality.

## Deployment

**Option A (recommended for iteration):** Run prod Docker Compose on dev Mac, expose via `cloudflared tunnel --url http://localhost:3000`.

**Option B (stable):** Alibaba Cloud HK ECS (2c2g, ~¥80/month). Build `linux/amd64` image locally with `docker buildx`, `scp` the tar, load and start on ECS. Use Caddy as reverse proxy (auto HTTPS).

The SQLite file is persisted via Docker volume to `./data/` on the host.
