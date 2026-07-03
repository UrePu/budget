// 공용 타입 — 단일 소스. docs/SPEC.md 참고.

/** deposit/withdraw: 입출금, exchange_to_krw: 메소→원, exchange_to_meso: 원→메소 */
export type TxType =
  | "deposit"
  | "withdraw"
  | "exchange_to_krw"
  | "exchange_to_meso";
export type Currency = "meso" | "krw";

/** 1억 메소 (환산 기준 단위) */
export const MESO_UNIT = 100_000_000;
/** 기본 시세: 1억 메소당 원 (환전 폼 초기값) */
export const DEFAULT_RATE = 1800;

export interface Transaction {
  id: string;
  /** UTC ISO 문자열 (표시는 항상 Asia/Seoul 기준) */
  occurred_at: string;
  type: TxType;
  /** 환전은 항상 'meso' (amount=메소 양) */
  currency: Currency;
  /** meso: 메소 단위 그대로, krw: 원 */
  amount: number;
  /** 환전일 때 1억 메소당 원화 가격, 입출금이면 null */
  rate: number | null;
  tag: string | null;
  created_at: string;
}

export interface TransactionInput {
  occurred_at: string;
  type: TxType;
  currency: Currency;
  amount: number;
  rate: number | null;
  tag?: string | null;
}

export function isExchange(type: TxType): boolean {
  return type === "exchange_to_krw" || type === "exchange_to_meso";
}

/** 환전 거래의 원화 쪽 금액 (amount=메소 양, rate=1억당 원) */
export function exchangeKrw(
  t: Pick<Transaction, "amount" | "rate">,
): number {
  return Math.round((t.amount / MESO_UNIT) * (t.rate ?? 0));
}

/** 거래 하나가 메소/원 잔고 각각에 미치는 변화량 (메소·원화는 서로 환산하지 않음) */
export function balanceDeltas(
  t: Pick<Transaction, "type" | "currency" | "amount" | "rate">,
): { meso: number; krw: number } {
  switch (t.type) {
    case "deposit":
      return t.currency === "meso"
        ? { meso: t.amount, krw: 0 }
        : { meso: 0, krw: t.amount };
    case "withdraw":
      return t.currency === "meso"
        ? { meso: -t.amount, krw: 0 }
        : { meso: 0, krw: -t.amount };
    case "exchange_to_krw":
      return { meso: -t.amount, krw: exchangeKrw(t) };
    case "exchange_to_meso":
      return { meso: t.amount, krw: -exchangeKrw(t) };
  }
}
