import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { getUserByToken, insertSubmission, insertFeedback } from '@/lib/db';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  const schema = readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8');
  db.exec(schema);
});

afterEach(() => db.close());

describe('getUserByToken', () => {
  test('有效 token 返回用户记录', () => {
    db.prepare('INSERT INTO users (token, email, name) VALUES (?,?,?)').run('tok1', 'a@law.com', '张律师');
    const user = getUserByToken(db, 'tok1');
    expect(user?.email).toBe('a@law.com');
    expect(user?.name).toBe('张律师');
  });

  test('无效 token 返回 undefined', () => {
    expect(getUserByToken(db, 'notexist')).toBeUndefined();
  });
});

describe('insertSubmission', () => {
  beforeEach(() => {
    db.prepare('INSERT INTO users (token) VALUES (?)').run('u1');
  });

  test('插入成功后可按 id 查到记录', () => {
    insertSubmission(db, {
      id: 'sub1',
      userToken: 'u1',
      clientRole: 'employee',
      disputeCity: '北京',
      rawText: '劳动合同材料',
      fileMetadata: '[]',
      analysisResult: null,
      parseStatus: 'success',
      llmProvider: 'deepseek',
      llmModel: 'deepseek-chat',
      durationMs: 1200,
    });
    const row = db.prepare('SELECT * FROM submissions WHERE id=?').get('sub1') as Record<string, unknown>;
    expect(row.parse_status).toBe('success');
    expect(row.client_role).toBe('employee');
  });

  test('parseStatus=failed 时仍能写入（保留原始响应）', () => {
    insertSubmission(db, {
      id: 'sub2',
      userToken: 'u1',
      clientRole: 'employer',
      disputeCity: '上海',
      rawText: '材料',
      fileMetadata: '[]',
      analysisResult: 'raw broken response',
      parseStatus: 'failed',
      llmProvider: 'deepseek',
      llmModel: 'deepseek-chat',
      durationMs: 500,
    });
    const row = db.prepare('SELECT parse_status, analysis_result FROM submissions WHERE id=?').get('sub2') as Record<string, unknown>;
    expect(row.parse_status).toBe('failed');
    expect(row.analysis_result).toBe('raw broken response');
  });
});

describe('insertFeedback', () => {
  beforeEach(() => {
    db.prepare('INSERT INTO users (token) VALUES (?)').run('u1');
    db.prepare(
      'INSERT INTO submissions (id,user_token,client_role,raw_text,parse_status,llm_provider,llm_model) VALUES (?,?,?,?,?,?,?)'
    ).run('sub1', 'u1', 'employee', '材料', 'success', 'deepseek', 'deepseek-chat');
  });

  test('评分和评论正确写入 feedback 表', () => {
    insertFeedback(db, {
      id: 'fb1',
      submissionId: 'sub1',
      userToken: 'u1',
      rating: 4,
      comment: '焦点识别准确，法条引用规范',
      llmProvider: 'deepseek',
      llmModel: 'deepseek-chat',
    });
    const row = db.prepare('SELECT * FROM feedback WHERE id=?').get('fb1') as Record<string, unknown>;
    expect(row.rating).toBe(4);
    expect(row.comment).toBe('焦点识别准确，法条引用规范');
  });
});
