// PATCH /api/transactions/:id — 부분 수정
// DELETE /api/transactions/:id — 삭제 (204)
// Next.js 16: params 는 Promise 이므로 await 해서 사용한다.

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/server/auth";
import { getSupabase } from "@/lib/server/supabase";
import { validateTransactionPatch } from "@/lib/server/validate";
import type { Transaction } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "잘못된 id 입니다." }, { status: 400 });
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

  const supabase = getSupabase();

  // currency ↔ rate 정합성 검사를 위해 기존 레코드를 먼저 조회
  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("currency, rate")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: `거래 조회 실패: ${fetchError.message}` },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "거래를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const result = validateTransactionPatch(body, existing);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(result.value)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `거래 수정 실패: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ transaction: data as Transaction });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "잘못된 id 입니다." }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("transactions")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: `거래 삭제 실패: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "거래를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
