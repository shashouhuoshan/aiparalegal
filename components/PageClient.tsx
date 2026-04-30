'use client';

import { useEffect, useState } from 'react';
import { InputSection } from '@/components/InputSection';
import { ResultSection } from '@/components/ResultSection';
import { FeedbackForm } from '@/components/FeedbackForm';
import type { AnalysisResult } from '@/lib/schema';

type Phase = 'input' | 'result' | 'done';

export function PageClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('input');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [submissionId, setSubmissionId] = useState('');

  useEffect(() => {
    // token 已由服务端验证，仅做 URL 清理
    const url = new URL(window.location.href);
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleResult = (data: unknown, sid: string) => {
    setResult(data as AnalysisResult);
    setSubmissionId(sid);
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFeedbackSubmitted = () => setPhase('done');

  const handleReset = () => {
    setResult(null);
    setSubmissionId('');
    setPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">劳动争议 AI 分析</h1>
        <p className="mt-1 text-sm text-gray-500">上传案件材料，AI 自动识别争议焦点并引用法条</p>
      </header>

      {phase === 'done' && (
        <div className="mb-6 flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
          <span className="text-sm text-green-800">感谢反馈！</span>
          <button
            onClick={handleReset}
            className="text-sm font-medium text-green-700 underline hover:text-green-900"
          >
            继续上传新案件 →
          </button>
        </div>
      )}

      {phase === 'input' && <InputSection onResult={handleResult} />}

      {(phase === 'result' || phase === 'done') && result && (
        <>
          <ResultSection result={result} />
          {phase === 'result' && (
            <FeedbackForm submissionId={submissionId} onSubmitted={handleFeedbackSubmitted} />
          )}
        </>
      )}
    </main>
  );
}
