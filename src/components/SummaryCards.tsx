"use client";

// 월 요약 카드: 입금 / 출금 / 순액 (원화 환산 기준) + 메소 합계 별도 표기
import { toKrw, type Transaction } from "@/lib/types";
import { formatKrw, formatSignedKrw, formatSignedMeso } from "@/lib/format";

interface Props {
  transactions: Transaction[];
}

export default function SummaryCards({ transactions }: Props) {
  let depositKrw = 0;
  let withdrawKrw = 0;
  let depositMeso = 0;
  let withdrawMeso = 0;

  for (const t of transactions) {
    const krw = toKrw(t);
    if (t.type === "deposit") {
      depositKrw += krw;
      if (t.currency === "meso") depositMeso += t.amount;
    } else {
      withdrawKrw += krw;
      if (t.currency === "meso") withdrawMeso += t.amount;
    }
  }

  const netKrw = depositKrw - withdrawKrw;
  const netMeso = depositMeso - withdrawMeso;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-3 shadow-sm">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">입금</p>
        <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400 break-all">
          {formatKrw(depositKrw)}
        </p>
        {depositMeso > 0 && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 break-all">
            {formatSignedMeso(depositMeso)}
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-3 shadow-sm">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">출금</p>
        <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-400 break-all">
          {formatKrw(withdrawKrw)}
        </p>
        {withdrawMeso > 0 && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 break-all">
            {formatSignedMeso(-withdrawMeso)}
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-3 shadow-sm">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">순액</p>
        <p
          className={`mt-1 text-sm font-bold break-all ${
            netKrw > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : netKrw < 0
                ? "text-red-600 dark:text-red-400"
                : ""
          }`}
        >
          {formatSignedKrw(netKrw)}
        </p>
        {netMeso !== 0 && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 break-all">
            {formatSignedMeso(netMeso)}
          </p>
        )}
      </div>
    </div>
  );
}
