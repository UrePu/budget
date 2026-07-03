// 공용 타입 — 단일 소스. docs/SPEC.md 참고.

export type TxType = "deposit" | "withdraw";
export type Currency = "meso" | "krw";

/** 1억 메소 (환산 기준 단위) */
export const MESO_UNIT = 100_000_000;
/** 기본 시세: 1억 메소당 원 */
export const DEFAULT_RATE = 1800;

export interface Transaction {
  id: string;
  /** UTC ISO 문자열 (표시는 항상 Asia/Seoul 기준) */
  occurred_at: string;
  type: TxType;
  currency: Currency;
  /** meso: 메소 단위 그대로, krw: 원 */
  amount: number;
  /** currency=meso 일 때 1억 메소당 원화 가격, krw면 null */
  rate: number | null;
  memo: string | null;
  created_at: string;
}

export interface TransactionInput {
  occurred_at: string;
  type: TxType;
  currency: Currency;
  amount: number;
  rate: number | null;
  memo?: string | null;
}

/** 메소 거래의 원화 환산액 (krw 거래는 amount 그대로) */
export function toKrw(t: Pick<Transaction, "currency" | "amount" | "rate">): number {
  if (t.currency === "krw") return t.amount;
  return Math.round((t.amount / MESO_UNIT) * (t.rate ?? DEFAULT_RATE));
}
