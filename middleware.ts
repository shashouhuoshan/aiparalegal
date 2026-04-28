import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/api/health'];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{12,32}$/;

function extractToken(request: NextRequest): string | null {
  const cookie = request.cookies.get('invite_token')?.value;
  if (cookie) return cookie;
  return request.nextUrl.searchParams.get('t');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = extractToken(request);

  if (!token || !TOKEN_PATTERN.test(token)) {
    return new NextResponse(
      '<!DOCTYPE html><html><body><h1>链接无效或已过期</h1><p>请联系管理员获取新的邀请链接。</p></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const response = NextResponse.next();
  // 首次访问通过 ?t= 带入时，将 token 固化到 cookie（30天）
  if (!request.cookies.get('invite_token') && token) {
    response.cookies.set('invite_token', token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
