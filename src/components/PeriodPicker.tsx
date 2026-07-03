"use client";

// 기간 선택: 월간/주간 토글 + ← 라벨 → 이동.
// 가운데 라벨을 탭하면 네이티브 피커(month/date)로 원하는 날짜로 바로 점프할 수 있다.
// (라벨 위에 투명한 input 을 겹쳐 두는 방식 — showPicker() 미지원 브라우저에서도 동작)

import {
  formatMonthLabel,
  formatWeekLabel,
  shiftDate,
  shiftMonth,
  weekStartOf,
} from "@/lib/client/time";
import SegmentedControl from "@/components/SegmentedControl";

export type PeriodMode = "month" | "week";

interface Props {
  mode: PeriodMode;
  month: string; // "YYYY-MM"
  weekStart: string; // "YYYY-MM-DD" (월요일)
  onModeChange: (mode: PeriodMode) => void;
  onMonthChange: (month: string) => void;
  onWeekChange: (weekStart: string) => void;
}

export default function PeriodPicker({
  mode,
  month,
  weekStart,
  onModeChange,
  onMonthChange,
  onWeekChange,
}: Props) {
  const isMonth = mode === "month";

  function handlePrev() {
    if (isMonth) onMonthChange(shiftMonth(month, -1));
    else onWeekChange(shiftDate(weekStart, -7));
  }

  function handleNext() {
    if (isMonth) onMonthChange(shiftMonth(month, 1));
    else onWeekChange(shiftDate(weekStart, 7));
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl<PeriodMode>
        ariaLabel="모아보기 기간"
        options={[
          { value: "month", label: "월간" },
          { value: "week", label: "주간" },
        ]}
        value={mode}
        onChange={onModeChange}
      />

      <div className="flex items-center justify-between rounded-2xl bg-card border border-black/5 dark:border-white/10 px-2 py-1.5 shadow-sm">
        <button
          type="button"
          aria-label={isMonth ? "이전 달" : "이전 주"}
          onClick={handlePrev}
          className="h-10 w-12 shrink-0 rounded-xl text-lg text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
        >
          ←
        </button>

        {/* 라벨 + 투명 네이티브 피커 오버레이 */}
        <span className="relative flex h-10 min-w-0 flex-1 items-center justify-center">
          <span
            className={`font-semibold tabular-nums truncate ${
              isMonth ? "text-base" : "text-sm"
            }`}
          >
            {isMonth ? formatMonthLabel(month) : formatWeekLabel(weekStart)}
          </span>
          {isMonth ? (
            <input
              type="month"
              aria-label="월 직접 선택"
              value={month}
              onChange={(e) => {
                if (e.target.value) onMonthChange(e.target.value);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          ) : (
            <input
              type="date"
              aria-label="날짜로 주 선택"
              value={weekStart}
              onChange={(e) => {
                if (e.target.value) onWeekChange(weekStartOf(e.target.value));
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          )}
        </span>

        <button
          type="button"
          aria-label={isMonth ? "다음 달" : "다음 주"}
          onClick={handleNext}
          className="h-10 w-12 shrink-0 rounded-xl text-lg text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
        >
          →
        </button>
      </div>
    </div>
  );
}
