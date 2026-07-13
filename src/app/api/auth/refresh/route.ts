// POST /api/auth/refresh — 유효한 세션이면 만료를 30일 뒤로 연장한 쿠키 재발급.
// 거래 저장 직전에 호출해 세션이 살아있는지 확인 + 슬라이딩 연장한다.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  getSessionAccountId,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";

export async function POST() {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const token = await createSessionToken(accountId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ ok: true });
}
