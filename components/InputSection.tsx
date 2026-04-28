'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '其他'];

interface Props {
  onResult: (result: unknown, submissionId: string) => void;
}

export function InputSection({ onResult }: Props) {
  const [clientRole, setClientRole] = useState<'employee' | 'employer'>('employee');
  const [disputeCity, setDisputeCity] = useState('北京');
  const [caseNote, setCaseNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 10,
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('clientRole', clientRole);
      form.append('disputeCity', disputeCity);
      form.append('caseNote', caseNote);
      files.forEach((f) => form.append('files', f));

      const token = localStorage.getItem('invite_token') ?? '';
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: form,
        headers: token ? { cookie: `invite_token=${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '请求失败，请重试');
        return;
      }
      onResult(json, json.submissionId);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 当事人角色 */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">代理方</p>
        <div className="flex gap-4">
          {[
            { value: 'employee', label: '代理劳动者' },
            { value: 'employer', label: '代理用人单位' },
          ].map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="clientRole"
                value={value}
                checked={clientRole === value}
                onChange={() => setClientRole(value as 'employee' | 'employer')}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 争议城市 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">争议城市</label>
        <select
          value={disputeCity}
          onChange={(e) => setDisputeCity(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* 文件上传 */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">上传材料（PDF / DOCX，最多10个）</p>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-gray-500">
            {isDragActive ? '松开鼠标上传文件' : '拖拽文件到此处，或点击选择'}
          </p>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-xs text-gray-600">
                <span>📄 {f.name}</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 案情补充 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">案情补充（可选）</label>
        <Textarea
          value={caseNote}
          onChange={(e) => setCaseNote(e.target.value)}
          placeholder="可粘贴微信聊天记录、口头陈述要点等补充说明..."
          rows={4}
        />
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={loading} className="w-full py-3 text-base">
        {loading ? '分析中，请稍候...' : '开始分析'}
      </Button>
    </div>
  );
}
