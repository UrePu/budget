"use client";

// 월 달력 그리드 — 날짜별 메소/원화 순변화를 각각 표시하고,
// 날짜를 탭하면 그 날만 모아본다. 다시 탭하면 선택 해제(월 전체 보기).
// (전달받은 transactions 는 이미 태그 필터가 적용된 상태)

import { balanceDeltas, type Transaction } from "@/lib/types";
import { formatCompactKrw, formatCompactMeso } from "@/lib/format";
import { dateKey, todayDateKey } from "@/lib/client/time";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  month: string; // "YYYY-MM"
  transactions: Transaction[]; // 그 달 전체 거래 (태그 필터 적용됨)
  selectedDate: string | null; // "YYYY-MM-DD" | null
  onSelectDate: (dateKey: string | null) => void;
}

export default function CalendarView({
  month,
  transactions,
  selectedDate,
  onSelectDate,
}: Props) {
  const [year, mon] = month.split("-").map(Number);

  // 날짜별 메소/원화 순변화 집계
  const netByDate = new Map<string, { meso: number; krw: number }>();
  for (const t of transactions) {
    const key = dateKey(t.occurred_at);
    const d = balanceDeltas(t);
    const acc = netByDate.get(key) ?? { meso: 0, krw: 0 };
    acc.meso += d.meso;
    acc.krw += d.krw;
    netByDate.set(key, acc);
  }

  const firstDow = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay(); // 0=일
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const today = todayDateKey();

  // 앞쪽 빈 칸 + 날짜 칸
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const deltaClass = (n: number, selected: boolean) =>
    selected
      ? ""
      : n > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-2 shadow-sm">
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_HEADER.map((w, i) => (
          <div
            key={w}
            className={`pb-1 text-center text-[11px] font-semibold ${
              i === 0
                ? "text-red-500 dark:text-red-400"
                : i === 6
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {w}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} />;
          const key = `${year}-${pad(mon)}-${pad(day)}`;
          const net = netByDate.get(key);
          const isSelected = selectedDate === key;
          const isToday = today === key;
          const dow = idx % 7;

          return (
            <button
              key={key}
              type="button"
              aria-label={`${mon}월 ${day}일`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`flex h-14 flex-col items-center justify-start rounded-lg pt-1 transition active:scale-95 ${
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "active:bg-zinc-100 dark:active:bg-zinc-800"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums ${
                  isToday && !isSelected
                    ? "bg-zinc-200 dark:bg-zinc-700 font-bold"
                    : ""
                } ${
                  isSelected
                    ? ""
                    : dow === 0
                      ? "text-red-500 dark:text-red-400"
                      : dow === 6
                        ? "text-blue-500 dark:text-blue-400"
                        : ""
                }`}
              >
                {day}
              </span>
              {net && net.meso !== 0 && (
                <span
                  className={`max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight tabular-nums ${deltaClass(net.meso, isSelected)}`}
                >
                  {formatCompactMeso(net.meso)}
                </span>
              )}
              {net && net.krw !== 0 && (
                <span
                  className={`max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight tabular-nums ${deltaClass(net.krw, isSelected)}`}
                >
                  {formatCompactKrw(net.krw)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
