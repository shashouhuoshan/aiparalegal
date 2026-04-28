import { NextResponse } from 'next/server';
import { generateId } from '@/lib/id';
import { getDb, getUserByToken, insertFeedback } from '@/lib/db';
import { LLM_MODEL, LLM_PROVIDER } from '@/lib/llm';

function getToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/invite_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const db = getDb();
  const user = getUserByToken(db, token);
  if (!user) {
    return NextResponse.json({ error: '链接无效或已过期' }, { status: 401 });
  }

  let body: { submissionId?: string; rating?: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const { submissionId, rating, comment } = body;
  if (!submissionId || rating === undefined || !comment?.trim()) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: '评分须在 1-5 之间' }, { status: 400 });
  }

  insertFeedback(db, {
    id: generateId(12),
    submissionId,
    userToken: token,
    rating,
    comment: comment.trim(),
    llmProvider: LLM_PROVIDER,
    llmModel: LLM_MODEL,
  });

  return NextResponse.json({ ok: true });
}
