"use client";

// 기간 요약 — 메소와 원화를 서로 환산하지 않고 각각 따로 집계한다.
// 환전 거래는 양쪽 잔고에 반영 (메소→원: 메소 감소 + 원 증가).
import { balanceDeltas, type Transaction } from "@/lib/types";
import {
  formatKrw,
  formatMeso,
  formatSignedKrw,
  formatSignedMeso,
} from "@/lib/format";

interface Props {
  transactions: Transaction[];
}

export default function SummaryCards({ transactions }: Props) {
  let mesoIn = 0;
  let mesoOut = 0;
  let krwIn = 0;
  let krwOut = 0;

  for (const t of transactions) {
    const d = balanceDeltas(t);
    if (d.meso > 0) mesoIn += d.meso;
    else mesoOut += -d.meso;
    if (d.krw > 0) krwIn += d.krw;
    else krwOut += -d.krw;
  }

  const mesoNet = mesoIn - mesoOut;
  const krwNet = krwIn - krwOut;

  const netClass = (net: number) =>
    net > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : net < 0
        ? "text-red-600 dark:text-red-400"
        : "";

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-3 shadow-sm">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">메소</p>
        <p className={`mt-1 text-base font-bold break-all ${netClass(mesoNet)}`}>
          {formatSignedMeso(mesoNet)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 break-all tabular-nums">
          +{formatMeso(mesoIn)} · -{formatMeso(mesoOut)}
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-3 shadow-sm">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">원화</p>
        <p className={`mt-1 text-base font-bold break-all ${netClass(krwNet)}`}>
          {formatSignedKrw(krwNet)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 break-all tabular-nums">
          +{formatKrw(krwIn)} · -{formatKrw(krwOut)}
        </p>
      </div>
    </div>
  );
}
