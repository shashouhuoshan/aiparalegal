import { POST } from '@/app/api/analyze/route';

jest.mock('@/lib/llm', () => ({
  llm: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '员工被违法辞退，未支付补偿金。',
                  dispute_points: [
                    {
                      title: '违法解除劳动合同',
                      our_position: '未提前30天通知',
                      opposing_arguments: ['员工违纪'],
                      key_evidence: ['劳动合同 file_1'],
                      applicable_laws: [{ citation: '《劳动合同法》第87条', text: '支付赔偿金' }],
                      risks: '举证不足',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  },
  LLM_MODEL: 'test-model',
  LLM_PROVIDER: 'test',
}));

jest.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const { readFileSync } = require('fs');
  const path = require('path');
  const db = new Database(':memory:');
  db.exec(readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8'));
  db.prepare('INSERT INTO users (token) VALUES (?)').run('valid-token');
  const real = jest.requireActual('@/lib/db');
  return { ...real, getDb: () => db };
});

jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'PDF内容' }));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'DOCX内容' }),
}));

describe('POST /api/analyze', () => {
  test('有效请求返回 dispute_points', async () => {
    const form = new FormData();
    form.append('clientRole', 'employee');
    form.append('disputeCity', '北京');
    form.append('caseNote', '员工被违法辞退');

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: form,
      headers: { cookie: 'invite_token=valid-token' },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dispute_points).toHaveLength(1);
    expect(json.summary).toBeDefined();
  });

  test('无效 token 返回 401', async () => {
    const form = new FormData();
    form.append('clientRole', 'employee');
    form.append('disputeCity', '北京');

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: form,
      headers: { cookie: 'invite_token=bad-token' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('LLM 返回非法 JSON 时 parse_status 写 failed，返回 422', async () => {
    const { llm } = require('@/lib/llm');
    (llm.chat.completions.create as jest.Mock).mockResolvedValueOnce({
      choices: [{ message: { content: 'not valid json' } }],
    });

    const form = new FormData();
    form.append('clientRole', 'employee');
    form.append('disputeCity', '上海');
    form.append('caseNote', '材料');

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: form,
      headers: { cookie: 'invite_token=valid-token' },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBeDefined();
  });
});
