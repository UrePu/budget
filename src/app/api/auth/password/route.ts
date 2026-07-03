// POST /api/auth/password — body { current, next } : 로그인된 계정의 비밀번호 변경
// current 가 이 계정의 비밀번호와 일치해야 하고, next 는 다른 계정과 겹치면 안 된다.

import { NextResponse } from "next/server";
import { getSessionAccountId, hashPassword } from "@/lib/server/auth";
import { getSupabase } from "@/lib/server/supabase";

const MIN_PASSWORD_LENGTH = 4;

export async function POST(request: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 },
    );
  }

  const { current, next } = (body ?? {}) as {
    current?: unknown;
    next?: unknown;
  };
  if (typeof current !== "string" || current.length === 0) {
    return NextResponse.json(
      { error: "현재 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }
  if (typeof next !== "string" || next.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }

  const supabase = getSupabase();
  const currentHmac = await hashPassword(current);

  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("id, password_hmac")
    .eq("id", accountId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: `계정 조회 실패: ${fetchError.message}` },
      { status: 500 },
    );
  }
  if (!account || account.password_hmac !== currentHmac) {
    return NextResponse.json(
      { error: "현재 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const nextHmac = await hashPassword(next);
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ password_hmac: nextHmac })
    .eq("id", accountId);

  if (updateError) {
    // unique 위반 = 다른 계정이 이미 쓰는 비밀번호
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "이미 사용 중인 비밀번호입니다. 다른 비밀번호를 정해 주세요." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `비밀번호 변경 실패: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
