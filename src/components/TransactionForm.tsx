"use client";

// 거래 입력/수정 폼 — 핵심 UX
// - 입금/출금, 메소/원 segmented 토글
// - 금액 콤마 자동 포맷 (내부 상태는 숫자 문자열)
// - 메소 선택 시 시세(1억당 원) 입력 + 실시간 환산 원화 표시
// - 일시(datetime-local, 한국 시간 기준 — 저장 시 UTC ISO 변환)
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_RATE,
  toKrw,
  type Currency,
  type Transaction,
  type TransactionInput,
  type TxType,
} from "@/lib/types";
import { addCommas, formatKrw, formatMeso, parseDigits } from "@/lib/format";
import {
  localInputToUtcIso,
  nowLocalInput,
  utcIsoToLocalInput,
} from "@/lib/client/time";
import SegmentedControl from "@/components/SegmentedControl";

const LAST_RATE_KEY = "lastRate";

interface Props {
  /** 수정 대상 (null 이면 새 거래 입력 모드) */
  editing: Transaction | null;
  /** 401 처리가 포함된 fetch 래퍼 */
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** 저장 성공 시 (목록 갱신) */
  onSaved: () => void;
  /** 수정 취소 */
  onCancelEdit: () => void;
}

export default function TransactionForm({
  editing,
  apiFetch,
  onSaved,
  onCancelEdit,
}: Props) {
  // 부모(HomeClient)에서 key={editing?.id ?? "new"} 로 렌더하므로
  // editing 은 이 인스턴스의 수명 동안 불변 — 초기값으로 바로 세팅한다.
  const [type, setType] = useState<TxType>(editing?.type ?? "deposit");
  const [currency, setCurrency] = useState<Currency>(
    editing?.currency ?? "meso",
  );
  const [amountText, setAmountText] = useState(() =>
    editing ? addCommas(String(editing.amount)) : "",
  );
  const [rateText, setRateText] = useState(() =>
    editing && editing.currency === "meso" && editing.rate != null
      ? String(editing.rate)
      : String(DEFAULT_RATE),
  );
  const [occurredLocal, setOccurredLocal] = useState(() =>
    editing ? utcIsoToLocalInput(editing.occurred_at) : "",
  );
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // 새 거래 모드 초기화: 마지막 사용 시세 복원 + 현재 시각 세팅
  // (SSR hydration mismatch 방지를 위해 마운트 후 비동기로 세팅)
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(LAST_RATE_KEY);
        if (saved && Number(saved) > 0) setRateText(saved);
      } catch {
        // localStorage 접근 불가 시 기본값 유지
      }
      setOccurredLocal((prev) => prev || nowLocalInput());
    }, 0);
    return () => clearTimeout(t);
  }, [editing]);

  const amount = parseDigits(amountText);
  // rate 는 API 상 소수 허용(예: 1850.5)이므로 콤마만 제거하고 Number 로 파싱한다.
  // (parseDigits 를 쓰면 "1850.5" → 18505 로 잘못 읽힘 — 수정 모드 초기값에서 발생 가능)
  const rateNum = Number(rateText.replace(/,/g, ""));
  const rate = Number.isFinite(rateNum) && rateNum > 0 ? rateNum : 0;
  const convertedKrw =
    currency === "meso" && amount > 0 && rate > 0
      ? toKrw({ currency: "meso", amount, rate })
      : null;

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 15);
    setAmountText(addCommas(digits));
  }

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
    setRateText(digits);
  }

  function resetForm() {
    setAmountText("");
    setMemo("");
    setOccurredLocal(nowLocalInput());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (amount <= 0) {
      setError("금액을 입력해 주세요.");
      amountRef.current?.focus();
      return;
    }
    if (currency === "meso" && rate <= 0) {
      setError("시세(1억당 원)를 입력해 주세요.");
      return;
    }
    if (!occurredLocal) {
      setError("일시를 입력해 주세요.");
      return;
    }

    let occurredAtIso: string;
    try {
      occurredAtIso = localInputToUtcIso(occurredLocal);
    } catch {
      setError("일시 형식이 올바르지 않습니다.");
      return;
    }

    const input: TransactionInput = {
      occurred_at: occurredAtIso,
      type,
      currency,
      amount,
      rate: currency === "meso" ? rate : null,
      memo: memo.trim() ? memo.trim() : null,
    };

    setSaving(true);
    setError(null);
    try {
      const res = editing
        ? await apiFetch(`/api/transactions/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          })
        : await apiFetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });

      if (!res.ok) {
        let message = "저장에 실패했습니다.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // JSON 아님 — 기본 메시지 사용
        }
        setError(message);
        return;
      }

      if (currency === "meso" && rate > 0) {
        try {
          localStorage.setItem(LAST_RATE_KEY, String(rate));
        } catch {
          // 저장 실패 무시
        }
      }

      if (editing) {
        // key 변경으로 새 거래 폼으로 리마운트됨
        onCancelEdit();
      } else {
        resetForm();
      }
      onSaved();
    } catch (err) {
      if ((err as Error)?.message !== "unauthorized") {
        setError("네트워크 오류가 발생했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-card border border-black/5 dark:border-white/10 p-4 shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {editing ? "거래 수정" : "새 거래"}
        </h2>
        {editing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-zinc-500 dark:text-zinc-400 underline underline-offset-2"
          >
            수정 취소
          </button>
        )}
      </div>

      <SegmentedControl<TxType>
        ariaLabel="거래 종류"
        value={type}
        onChange={setType}
        options={[
          {
            value: "deposit",
            label: "입금",
            activeClass: "text-emerald-600 dark:text-emerald-400",
          },
          {
            value: "withdraw",
            label: "출금",
            activeClass: "text-red-600 dark:text-red-400",
          },
        ]}
      />

      <SegmentedControl<Currency>
        ariaLabel="통화"
        value={currency}
        onChange={setCurrency}
        options={[
          { value: "meso", label: "메소" },
          { value: "krw", label: "원" },
        ]}
      />

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          금액 {currency === "meso" ? "(메소)" : "(원)"}
        </label>
        <input
          ref={amountRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={currency === "meso" ? "예: 350,000,000" : "예: 50,000"}
          value={amountText}
          onChange={handleAmountChange}
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-lg tabular-nums outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
        {currency === "meso" && amount > 0 && (
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            = {formatMeso(amount)}
            {convertedKrw != null && (
              <span className="ml-2 font-medium text-zinc-700 dark:text-zinc-300">
                ≈ {formatKrw(convertedKrw)}
              </span>
            )}
          </p>
        )}
      </div>

      {currency === "meso" && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            시세 (1억 메소당 원)
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1800"
            value={rateText}
            onChange={handleRateChange}
            className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base tabular-nums outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          일시
        </label>
        <input
          type="datetime-local"
          value={occurredLocal}
          onChange={(e) => setOccurredLocal(e.target.value)}
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          메모 (선택)
        </label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 큐브 구매"
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className={`h-13 min-h-12 w-full rounded-xl text-base font-bold text-white disabled:opacity-40 active:scale-[0.99] transition ${
          type === "deposit"
            ? "bg-emerald-600 dark:bg-emerald-500"
            : "bg-red-600 dark:bg-red-500"
        }`}
      >
        {saving ? "저장 중..." : editing ? "수정 저장" : "저장"}
      </button>
    </form>
  );
}
