// 거래 입력 유효성 검증 + 월 범위(UTC) 계산 유틸 — 서버 전용
// 시간대는 한국 시간(Asia/Seoul) 고정.

import { isExchange, type Currency, type TransactionInput, type TxType } from "@/lib/types";

const TX_TYPES: readonly TxType[] = [
  "deposit",
  "withdraw",
  "exchange_to_krw",
  "exchange_to_meso",
];
const CURRENCIES: readonly Currency[] = ["meso", "krw"];
const MAX_TAG_LENGTH = 20;

/** 앱 전체 기준 시간대 (고정) */
const KST = "Asia/Seoul";

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

function err(message: string): Err {
  return { ok: false, error: message };
}

function parseOccurredAt(v: unknown): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // UTC ISO 로 정규화하여 저장
}

/** tag 필드 검증 → 정규화(trim, 빈 문자열은 null) */
function parseTag(v: unknown): Ok<string | null> | Err {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return err("tag 는 문자열이어야 합니다.");
  const tag = v.trim();
  if (tag.length > MAX_TAG_LENGTH) {
    return err(`tag 는 ${MAX_TAG_LENGTH}자 이하여야 합니다.`);
  }
  return { ok: true, value: tag === "" ? null : tag };
}

/** POST 본문 전체 검증 → 정규화된 TransactionInput */
export function validateTransactionInput(
  body: unknown,
): Ok<TransactionInput> | Err {
  if (typeof body !== "object" || body === null) {
    return err("잘못된 요청 본문입니다.");
  }
  const b = body as Record<string, unknown>;

  if (!TX_TYPES.includes(b.type as TxType)) {
    return err(
      "type 은 deposit/withdraw/exchange_to_krw/exchange_to_meso 여야 합니다.",
    );
  }
  const type = b.type as TxType;

  if (!CURRENCIES.includes(b.currency as Currency)) {
    return err("currency 는 meso 또는 krw 여야 합니다.");
  }
  const currency = b.currency as Currency;

  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    return err("amount 는 0보다 큰 숫자여야 합니다.");
  }
  const amount = b.amount;

  // 환전: currency=meso 고정 + rate 필수 / 입출금: rate 없음
  let rate: number | null;
  if (isExchange(type)) {
    if (currency !== "meso") {
      return err("환전 거래의 currency 는 meso(amount=메소 양)여야 합니다.");
    }
    if (typeof b.rate !== "number" || !Number.isFinite(b.rate) || b.rate <= 0) {
      return err("환전 거래는 rate(1억당 원, 0보다 큰 숫자)가 필요합니다.");
    }
    rate = b.rate;
  } else {
    if (b.rate !== null && b.rate !== undefined) {
      return err("수입/지출 거래의 rate 는 null 이어야 합니다.");
    }
    rate = null;
  }

  const occurred_at = parseOccurredAt(b.occurred_at);
  if (!occurred_at) {
    return err("occurred_at 은 ISO 형식 날짜여야 합니다.");
  }

  const tagResult = parseTag(b.tag);
  if (!tagResult.ok) return tagResult;

  return {
    ok: true,
    value: { occurred_at, type, currency, amount, rate, tag: tagResult.value },
  };
}

/**
 * PATCH 부분 수정 검증 — 제공된 필드만 검증해 update 객체를 만든다.
 * type/currency/rate 정합성은 기존 레코드와 병합한 결과 기준으로 확인한다.
 */
export function validateTransactionPatch(
  body: unknown,
  existing: { type: TxType; currency: Currency; rate: number | null },
): Ok<Partial<TransactionInput>> | Err {
  if (typeof body !== "object" || body === null) {
    return err("잘못된 요청 본문입니다.");
  }
  const b = body as Record<string, unknown>;
  const patch: Partial<TransactionInput> = {};

  if ("type" in b) {
    if (!TX_TYPES.includes(b.type as TxType)) {
      return err(
        "type 은 deposit/withdraw/exchange_to_krw/exchange_to_meso 여야 합니다.",
      );
    }
    patch.type = b.type as TxType;
  }

  if ("currency" in b) {
    if (!CURRENCIES.includes(b.currency as Currency)) {
      return err("currency 는 meso 또는 krw 여야 합니다.");
    }
    patch.currency = b.currency as Currency;
  }

  if ("amount" in b) {
    if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
      return err("amount 는 0보다 큰 숫자여야 합니다.");
    }
    patch.amount = b.amount;
  }

  if ("rate" in b) {
    if (b.rate === null) {
      patch.rate = null;
    } else if (typeof b.rate === "number" && Number.isFinite(b.rate) && b.rate > 0) {
      patch.rate = b.rate;
    } else {
      return err("rate 는 null 또는 0보다 큰 숫자여야 합니다.");
    }
  }

  if ("occurred_at" in b) {
    const iso = parseOccurredAt(b.occurred_at);
    if (!iso) return err("occurred_at 은 ISO 형식 날짜여야 합니다.");
    patch.occurred_at = iso;
  }

  if ("tag" in b) {
    const tagResult = parseTag(b.tag);
    if (!tagResult.ok) return tagResult;
    patch.tag = tagResult.value;
  }

  if (Object.keys(patch).length === 0) {
    return err("수정할 필드가 없습니다.");
  }

  // 병합 후 type ↔ currency ↔ rate 정합성 검사
  const mergedType = patch.type ?? existing.type;
  const mergedCurrency = patch.currency ?? existing.currency;
  const mergedRate = "rate" in patch ? (patch.rate ?? null) : existing.rate;
  if (isExchange(mergedType)) {
    if (mergedCurrency !== "meso") {
      return err("환전 거래의 currency 는 meso(amount=메소 양)여야 합니다.");
    }
    if (typeof mergedRate !== "number" || mergedRate <= 0) {
      return err("환전 거래는 rate(1억당 원, 0보다 큰 숫자)가 필요합니다.");
    }
  } else if (mergedRate !== null) {
    // 입출금으로 바꾸면서 rate 를 명시적으로 null 로 주지 않았다면 자동으로 null 처리
    patch.rate = null;
  }

  return { ok: true, value: patch };
}

// ---------------------------------------------------------------------------
// 월 범위(UTC) 계산 — 외부 날짜 라이브러리 없이 Intl.DateTimeFormat 만 사용
// ---------------------------------------------------------------------------

/**
 * 특정 UTC 시각(ts)이 한국 시간에서 보이는 벽시계 시각을
 * "그 벽시계 값을 UTC 로 간주한 epoch ms" 로 반환한다.
 * 예: ts = 2026-07-01T00:00:00Z → 벽시계 2026-07-01 09:00
 *     → Date.UTC(2026, 6, 1, 9, 0, 0) 을 반환.
 * (wallClockAsUtc(ts) - ts) 가 곧 그 시각의 KST UTC 오프셋(ms)이 된다.
 */
function wallClockAsUtc(ts: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: KST,
    hourCycle: "h23", // 자정을 24시가 아닌 0시로 받기 위함
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(ts))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/**
 * 한국 시간 벽시계 시각(wallUtc: 그 벽시계 값을 UTC 로 간주한 epoch ms)에
 * 대응하는 실제 UTC epoch ms 를 구한다.
 * ts 시점의 실제 오프셋 = wallClockAsUtc(ts) - ts 를 구해 ts = wallUtc - offset 로 보정.
 * (Asia/Seoul 은 DST 가 없어 +9h 고정이지만, Intl 기반 계산을 그대로 유지)
 */
function zonedWallTimeToUtc(wallUtc: number): number {
  const offset = wallClockAsUtc(wallUtc) - wallUtc;
  return wallUtc - offset;
}

/**
 * month("YYYY-MM")를 받아, 한국 시간 기준
 * [그 달의 시작, 다음 달의 시작) 에 해당하는 UTC ISO 범위를 반환한다.
 * 형식이 잘못되면 null.
 */
export function monthRangeUtc(
  month: string,
): { startIso: string; endIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]); // 1~12
  if (mon < 1 || mon > 12) return null;

  // 한국 시간의 "그 달 1일 00:00:00" / "다음 달 1일 00:00:00" 벽시계를 UTC 로 간주한 값
  const startWall = Date.UTC(year, mon - 1, 1, 0, 0, 0);
  const endWall = Date.UTC(mon === 12 ? year + 1 : year, mon % 12, 1, 0, 0, 0);

  return {
    startIso: new Date(zonedWallTimeToUtc(startWall)).toISOString(),
    endIso: new Date(zonedWallTimeToUtc(endWall)).toISOString(),
  };
}

/** "YYYY-MM-DD" → 벽시계 자정 epoch ms (실존하는 날짜가 아니면 null) */
function parseDateKeyWall(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const day = Number(m[3]);
  const wall = Date.UTC(year, mon - 1, day, 0, 0, 0);
  // Date.UTC 는 2026-02-31 같은 값을 3월로 넘겨버리므로 라운드트립으로 실존 여부 확인
  const d = new Date(wall);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== mon - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return wall;
}

/**
 * from/to("YYYY-MM-DD", 한국 시간 날짜, 양끝 포함)를 받아
 * [from 00:00, to 다음날 00:00) 에 해당하는 UTC ISO 범위를 반환한다.
 * 형식이 잘못됐거나 from > to 이면 null.
 */
export function dayRangeUtc(
  from: string,
  to: string,
): { startIso: string; endIso: string } | null {
  const startWall = parseDateKeyWall(from);
  const toWall = parseDateKeyWall(to);
  if (startWall === null || toWall === null || toWall < startWall) return null;
  const endWall = toWall + 24 * 60 * 60 * 1000; // to 다음날 자정 (exclusive)

  return {
    startIso: new Date(zonedWallTimeToUtc(startWall)).toISOString(),
    endIso: new Date(zonedWallTimeToUtc(endWall)).toISOString(),
  };
}
