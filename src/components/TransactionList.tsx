"use client";

// 거래 목록 — 날짜별 그룹핑, 수정/삭제. 환전 거래는 "메소 → 원" 형태로 표시.
import { exchangeKrw, isExchange, type Transaction } from "@/lib/types";
import { formatKrw, formatMeso } from "@/lib/format";
import { dateKey, formatDateHeading, formatTime } from "@/lib/client/time";

interface Props {
  transactions: Transaction[];
  loading: boolean;
  editingId: string | null;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

function AmountLabel({ t }: { t: Transaction }) {
  if (isExchange(t.type)) {
    const krw = formatKrw(exchangeKrw(t));
    const meso = formatMeso(t.amount);
    return (
      <p className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
        {t.type === "exchange_to_krw" ? `${meso} → ${krw}` : `${krw} → ${meso}`}
      </p>
    );
  }
  const isDeposit = t.type === "deposit";
  return (
    <p
      className={`text-base font-bold tabular-nums ${
        isDeposit
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {isDeposit ? "+" : "−"}{" "}
      {t.currency === "meso" ? formatMeso(t.amount) : formatKrw(t.amount)}
    </p>
  );
}

export default function TransactionList({
  transactions,
  loading,
  editingId,
  onEdit,
  onDelete,
}: Props) {
  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
        불러오는 중...
      </p>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
        거래 내역이 없습니다.
      </p>
    );
  }

  // occurred_at 내림차순(API 보장)을 유지하며 날짜(한국 시간 기준)로 그룹핑
  const groups: { key: string; items: Transaction[] }[] = [];
  for (const t of transactions) {
    const key = dateKey(t.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(t);
    } else {
      groups.push({ key, items: [t] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="px-1 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {formatDateHeading(group.key)}
          </h3>
          <ul className="rounded-2xl bg-card border border-black/5 dark:border-white/10 shadow-sm divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
            {group.items.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-3 p-3 ${
                  editingId === t.id ? "bg-zinc-100/70 dark:bg-zinc-800/50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <AmountLabel t={t} />
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatTime(t.occurred_at)}
                    {t.tag && (
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        #{t.tag}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 active:scale-95 transition"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    className="h-9 rounded-lg px-3 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 active:scale-95 transition"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
