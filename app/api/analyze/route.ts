import { NextResponse } from 'next/server';
import { generateId } from '@/lib/id';
import { getDb, getUserByToken, insertSubmission, updateUserActivity } from '@/lib/db';
import { extractText, concatenateFiles } from '@/lib/parsers';
import { llm, LLM_MODEL, LLM_PROVIDER } from '@/lib/llm';
import { buildSystemPrompt } from '@/lib/prompts';
import { AnalysisResultSchema } from '@/lib/schema';

function getToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/invite_token=([^;]+)/);
  if (match) return match[1];
  const url = new URL(request.url);
  return url.searchParams.get('t');
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

  const formData = await request.formData();
  const clientRole = (formData.get('clientRole') as string) ?? 'employee';
  const disputeCity = (formData.get('disputeCity') as string) ?? '';
  const caseNote = (formData.get('caseNote') as string) ?? '';
  const files = formData.getAll('files') as File[];

  const fileTexts: string[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      fileTexts.push(await extractText(files[i], i + 1));
    } catch {
      // skip unparseable files
    }
  }
  if (caseNote.trim()) {
    fileTexts.push(`[补充说明]\n${caseNote.trim()}`);
  }

  const rawText = concatenateFiles(fileTexts);
  const submissionId = generateId(12);
  const start = Date.now();

  let rawResponse = '';
  try {
    const completion = await llm.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(clientRole, disputeCity) },
        { role: 'user', content: rawText || '请基于以上材料进行分析。' },
      ],
      response_format: { type: 'json_object' },
    });

    rawResponse = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(rawResponse);
    const result = AnalysisResultSchema.parse(parsed);

    updateUserActivity(db, token);
    insertSubmission(db, {
      id: submissionId,
      userToken: token,
      clientRole,
      disputeCity,
      rawText,
      fileMetadata: JSON.stringify(files.map((f) => ({ name: f.name, size: f.size }))),
      analysisResult: rawResponse,
      parseStatus: 'success',
      llmProvider: LLM_PROVIDER,
      llmModel: LLM_MODEL,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ submissionId, ...result });
  } catch (err) {
    console.error('[analyze] error:', err);
    insertSubmission(db, {
      id: submissionId,
      userToken: token,
      clientRole,
      disputeCity,
      rawText,
      fileMetadata: '[]',
      analysisResult: rawResponse || null,
      parseStatus: 'failed',
      llmProvider: LLM_PROVIDER,
      llmModel: LLM_MODEL,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ error: '分析异常，请重试' }, { status: 422 });
  }
}
