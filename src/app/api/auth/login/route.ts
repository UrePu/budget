// POST /api/auth/login — body { password, mode?: "login" | "register", code? }
// login: 비밀번호 HMAC 으로 계정 조회 → 세션 쿠키 / 401
// register: 가입 코드(REGISTER_CODE)가 맞아야 새 계정 생성 (이미 있으면 409) → 세션 쿠키
// 비밀번호가 곧 계정 식별자이므로 최소 길이만 강제한다.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";
import { getSupabase } from "@/lib/server/supabase";

const MIN_PASSWORD_LENGTH = 4;

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

  const { password, mode, code } = (body ?? {}) as {
    password?: unknown;
    mode?: unknown;
    code?: unknown;
  };
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }
  const isRegister = mode === "register";

  // 새 가계부 생성은 가입 코드를 아는 사람만 가능
  if (isRegister) {
    const registerCode = process.env.REGISTER_CODE;
    if (!registerCode) {
      return NextResponse.json(
        { error: "가입이 막혀 있습니다. (REGISTER_CODE 미설정)" },
        { status: 403 },
      );
    }
    if (typeof code !== "string" || code !== registerCode) {
      return NextResponse.json(
        { error: "가입 코드가 올바르지 않습니다." },
        { status: 403 },
      );
    }
  }

  const passwordHmac = await hashPassword(password);
  const supabase = getSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from("accounts")
    .select("id")
    .eq("password_hmac", passwordHmac)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: `계정 조회 실패: ${lookupError.message}` },
      { status: 500 },
    );
  }

  let accountId: string;
  if (isRegister) {
    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 비밀번호입니다. 다른 비밀번호를 정해 주세요." },
        { status: 409 },
      );
    }
    const { data: created, error: insertError } = await supabase
      .from("accounts")
      .insert({ password_hmac: passwordHmac })
      .select("id")
      .single();
    if (insertError || !created) {
      return NextResponse.json(
        { error: `계정 생성 실패: ${insertError?.message ?? "알 수 없는 오류"}` },
        { status: 500 },
      );
    }
    accountId = created.id;
  } else {
    if (!existing) {
      return NextResponse.json(
        { error: "등록되지 않은 비밀번호입니다." },
        { status: 401 },
      );
    }
    accountId = existing.id;
  }

  const token = await createSessionToken(accountId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ ok: true });
}
