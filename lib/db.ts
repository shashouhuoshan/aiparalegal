import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';

export interface SubmissionData {
  id: string;
  userToken: string;
  clientRole: string;
  disputeCity: string | null;
  rawText: string;
  fileMetadata: string;
  analysisResult: string | null;
  parseStatus: 'success' | 'failed';
  llmProvider: string;
  llmModel: string;
  durationMs: number;
}

export interface FeedbackData {
  id: string;
  submissionId: string;
  userToken: string;
  rating: number;
  comment: string;
  llmProvider: string;
  llmModel: string;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH!;
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

export function getUserByToken(
  db: Database.Database,
  token: string
): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM users WHERE token = ?').get(token) as
    | Record<string, unknown>
    | undefined;
}

export function insertSubmission(db: Database.Database, data: SubmissionData): void {
  db.prepare(
    `INSERT INTO submissions
     (id, user_token, client_role, dispute_city, raw_text, file_metadata,
      analysis_result, parse_status, llm_provider, llm_model, duration_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    data.id,
    data.userToken,
    data.clientRole,
    data.disputeCity ?? null,
    data.rawText,
    data.fileMetadata,
    data.analysisResult,
    data.parseStatus,
    data.llmProvider,
    data.llmModel,
    data.durationMs
  );
}

export function insertFeedback(db: Database.Database, data: FeedbackData): void {
  db.prepare(
    `INSERT INTO feedback
     (id, submission_id, user_token, rating, comment, llm_provider, llm_model)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    data.id,
    data.submissionId,
    data.userToken,
    data.rating,
    data.comment,
    data.llmProvider,
    data.llmModel
  );
}

export function updateUserActivity(db: Database.Database, token: string): void {
  db.prepare('UPDATE users SET last_active_at = unixepoch() WHERE token = ?').run(token);
}

export function initDb(db: Database.Database): void {
  const schema = readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8');
  db.exec(schema);
}
