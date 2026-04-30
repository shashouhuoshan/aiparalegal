import { cookies } from 'next/headers';
import { getDb, getUserByToken } from '@/lib/db';
import { PageClient } from '@/components/PageClient';

export default function HomePage({ searchParams }: { searchParams: { t?: string } }) {
  const token = cookies().get('invite_token')?.value ?? searchParams.t ?? '';

  if (!token || !getUserByToken(getDb(), token)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">链接无效或已过期</h1>
        <p className="mt-2 text-gray-500">请联系管理员获取新的邀请链接。</p>
      </main>
    );
  }

  return <PageClient token={token} />;
}
