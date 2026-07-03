// GET /api/transactions?month=YYYY-MM — 한국 시간(Asia/Seoul) 기준 그 달의 거래 목록
// GET /api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD — 한국 시간 기준 일 범위(양끝 포함)
// POST /api/transactions — 거래 생성

import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/server/auth";
import { getSupabase } from "@/lib/server/supabase";
import {
  dayRangeUtc,
  monthRangeUtc,
  validateTransactionInput,
} from "@/lib/server/validate";
import type { Transaction } from "@/lib/types";

export async function GET(request: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // 한국 시간 기준 조회 범위: from/to(일 범위) 또는 month(월 범위)
  let range: { startIso: string; endIso: string } | null = null;
  if (from !== null || to !== null) {
    if (from === null || to === null) {
      return NextResponse.json(
        { error: "from 과 to 는 함께 지정해야 합니다." },
        { status: 400 },
      );
    }
    range = dayRangeUtc(from, to);
    if (!range) {
      return NextResponse.json(
        { error: "from/to 는 YYYY-MM-DD 형식이어야 하고 from ≤ to 여야 합니다." },
        { status: 400 },
      );
    }
  } else if (month !== null) {
    range = monthRangeUtc(month);
    if (!range) {
      return NextResponse.json(
        { error: "month 는 YYYY-MM 형식이어야 합니다." },
        { status: 400 },
      );
    }
  }

  let query = getSupabase()
    .from("transactions")
    .select("*")
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: false });

  if (range) {
    query = query.gte("occurred_at", range.startIso).lt("occurred_at", range.endIso);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `거래 목록 조회 실패: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ transactions: (data ?? []) as Transaction[] });
}

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

  const result = validateTransactionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("transactions")
    .insert({ ...result.value, account_id: accountId })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `거래 생성 실패: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ transaction: data as Transaction }, { status: 201 });
}
