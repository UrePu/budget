// 라우트 보호 — Next.js 16 의 proxy (middleware 후속, node_modules/next 에서
// PROXY_FILENAME='proxy' 및 "proxy 이름 또는 default export 함수" 지원 확인).
// 세션 검증은 Web Crypto 기반 verifySessionToken 을 사용하므로 edge/node 어느
// 런타임에서도 동작한다.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/auth";

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  // API 는 401 JSON, 페이지는 /login 으로 redirect
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // /login, /api/auth/login, Next 정적 리소스, favicon, 이미지 파일은 보호 대상에서 제외
  matcher: [
    "/((?!login|api/auth/login|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
