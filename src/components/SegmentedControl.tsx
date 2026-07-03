"use client";

// 터치 친화 segmented control (큰 버튼 토글)

interface Option<T extends string> {
  value: T;
  label: string;
  /** 선택 상태일 때 추가로 적용할 클래스 (색상 포인트 등) */
  activeClass?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid w-full gap-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`h-11 rounded-lg text-base font-semibold transition ${
              active
                ? `bg-card shadow-sm ${opt.activeClass ?? "text-zinc-900 dark:text-zinc-50"}`
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
