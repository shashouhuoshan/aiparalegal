'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  submissionId: string;
  onSubmitted: () => void;
}

export function FeedbackForm({ submissionId, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('请选择评分');
      return;
    }
    if (!comment.trim()) {
      setError('请填写反馈内容');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, rating, comment }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? '提交失败');
        return;
      }
      onSubmitted();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-800">这次分析的整体质量</h2>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            className={`text-2xl transition-transform hover:scale-110 ${
              s <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-sm text-gray-500">{rating} 分</span>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          最有价值的部分 / 最不准确的地方 / 你的建议 <span className="text-red-500">*</span>
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="请写下你的反馈..."
          rows={4}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? '提交中...' : '提交反馈'}
      </Button>
    </div>
  );
}
