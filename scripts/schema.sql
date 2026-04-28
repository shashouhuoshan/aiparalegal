-- 用户（邀请制）
CREATE TABLE IF NOT EXISTS users (
  token TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_active_at INTEGER
);

-- 提交（每次律师点"开始分析"产生一条记录）
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL REFERENCES users(token),
  client_role TEXT NOT NULL,
  dispute_city TEXT,
  raw_text TEXT NOT NULL,
  file_metadata TEXT,
  analysis_result TEXT,
  parse_status TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  duration_ms INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 反馈（律师对每次分析的评价）
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  user_token TEXT NOT NULL REFERENCES users(token),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_token);
CREATE INDEX IF NOT EXISTS idx_feedback_submission ON feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_feedback_model ON feedback(llm_provider, llm_model);
