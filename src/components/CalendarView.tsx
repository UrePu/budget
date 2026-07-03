"use client";

// 월 달력 그리드 — 날짜별 순액(원화 환산)을 표시하고, 날짜를 탭하면 그 날만 모아본다.
// 다시 탭하면 선택 해제(월 전체 보기).

import { toKrw, type Transaction } from "@/lib/types";
import { formatCompactKrw } from "@/lib/format";
import { dateKey, todayDateKey } from "@/lib/client/time";

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  month: string; // "YYYY-MM"
  transactions: Transaction[]; // 그 달 전체 거래
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

  // 날짜별 순액(원화 환산) 집계
  const netByDate = new Map<string, number>();
  for (const t of transactions) {
    const key = dateKey(t.occurred_at);
    const signed = (t.type === "deposit" ? 1 : -1) * toKrw(t);
    netByDate.set(key, (netByDate.get(key) ?? 0) + signed);
  }

  const firstDow = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay(); // 0=일
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const today = todayDateKey();

  // 앞쪽 빈 칸 + 날짜 칸
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

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
              className={`flex h-12 flex-col items-center justify-start rounded-lg pt-1 transition active:scale-95 ${
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
              {net !== undefined && (
                <span
                  className={`mt-0.5 max-w-full truncate px-0.5 text-[10px] font-semibold tabular-nums ${
                    isSelected
                      ? ""
                      : net > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : net < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {formatCompactKrw(net)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
