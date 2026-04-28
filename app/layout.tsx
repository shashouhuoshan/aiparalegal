import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '劳动争议 AI 分析',
  description: '基于 AI 的劳动争议焦点分析工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
