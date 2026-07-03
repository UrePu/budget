// POST /api/auth/login — body { password } → 200 + 세션 쿠키 설정 / 401

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 },
    );
  }

  const password = (body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword || password !== appPassword) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ ok: true });
}
