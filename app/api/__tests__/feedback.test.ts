import { POST } from '@/app/api/feedback/route';

jest.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const { readFileSync } = require('fs');
  const path = require('path');
  const db = new Database(':memory:');
  db.exec(readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8'));
  db.prepare('INSERT INTO users (token) VALUES (?)').run('valid-token');
  db.prepare(
    'INSERT INTO submissions (id,user_token,client_role,raw_text,parse_status,llm_provider,llm_model) VALUES (?,?,?,?,?,?,?)'
  ).run('sub-001', 'valid-token', 'employee', '材料', 'success', 'deepseek', 'deepseek-chat');
  const real = jest.requireActual('@/lib/db');
  return { ...real, getDb: () => db };
});

describe('POST /api/feedback', () => {
  test('有效请求写入 feedback 表，返回 200', async () => {
    const req = new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'invite_token=valid-token',
      },
      body: JSON.stringify({
        submissionId: 'sub-001',
        rating: 5,
        comment: '分析质量很高，法条引用准确',
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  test('缺少 comment 字段时返回 400', async () => {
    const req = new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'invite_token=valid-token',
      },
      body: JSON.stringify({
        submissionId: 'sub-001',
        rating: 3,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
