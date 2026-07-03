"use client";

// 수입/지출 입력/수정 폼 (환전은 Drawer 의 환전 폼에서 처리)
// - 수입/지출, 메소/원 segmented 토글
// - 메소는 억 단위로 입력 (예: 3.5 → 3억 5천만 메소), 원화는 콤마 자동 포맷
// - 메모 대신 태그: 기존 태그 칩에서 선택하거나 새로 입력
// - 일시(datetime-local, 한국 시간 기준 — 저장 시 UTC ISO 변환)
import { useEffect, useRef, useState } from "react";
import {
  MESO_UNIT,
  type Currency,
  type Transaction,
  type TransactionInput,
  type TxType,
} from "@/lib/types";
import { addCommas, formatMeso, parseDigits } from "@/lib/format";
import { MESO_PER_SOJAE, PRESET_TAGS, SOJAE_TAG } from "@/lib/tags";
import {
  localInputToUtcIso,
  nowLocalInput,
  utcIsoToLocalInput,
} from "@/lib/client/time";
import SegmentedControl from "@/components/SegmentedControl";

const MAX_TAG_LENGTH = 20;

interface Props {
  /** 수정 대상 (null 이면 새 거래 입력 모드, 환전 거래는 오지 않음) */
  editing: Transaction | null;
  /** 최근 사용 태그 (선택 칩) */
  tagSuggestions: string[];
  /** 401 처리가 포함된 fetch 래퍼 */
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** 저장 성공 시 (목록 갱신) */
  onSaved: () => void;
  /** 수정 취소 */
  onCancelEdit: () => void;
}

export default function TransactionForm({
  editing,
  tagSuggestions,
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
  const [amountText, setAmountText] = useState(() => {
    if (!editing) return "";
    // 메소: 사냥 태그면 소재 수, 아니면 억 단위 소수로 표시. 원화는 콤마 포맷
    if (editing.currency === "meso") {
      const unit = editing.tag === SOJAE_TAG ? MESO_PER_SOJAE : MESO_UNIT;
      return String(Math.round((editing.amount / unit) * 10_000) / 10_000);
    }
    return addCommas(String(editing.amount));
  });
  // 새 거래는 사냥 태그가 기본 선택 (메소 기준)
  const [tag, setTag] = useState(editing ? (editing.tag ?? "") : SOJAE_TAG);
  // 직접 입력칸은 기본 접힘 (프리셋에 없는 태그를 수정할 땐 펼침)
  const [showCustomTag, setShowCustomTag] = useState(
    () =>
      !!editing?.tag &&
      !PRESET_TAGS[editing.currency].includes(editing.tag),
  );
  const [occurredLocal, setOccurredLocal] = useState(() =>
    editing ? utcIsoToLocalInput(editing.occurred_at) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // 새 거래 모드 초기화: 현재 시각 세팅
  // (SSR hydration mismatch 방지를 위해 마운트 후 비동기로 세팅)
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => {
      setOccurredLocal((prev) => prev || nowLocalInput());
    }, 0);
    return () => clearTimeout(t);
  }, [editing]);

  // 메소: 사냥 태그면 소재 수("2" → 2.6억), 아니면 억 단위 소수("3.5" → 3억 5천만).
  // 원화는 정수(원) 입력
  const isSojae = currency === "meso" && tag.trim() === SOJAE_TAG;
  const amount =
    currency === "meso"
      ? Math.round(
          (Number(amountText) || 0) * (isSojae ? MESO_PER_SOJAE : MESO_UNIT),
        )
      : parseDigits(amountText);

  /** 태그 변경 — 사냥 여부가 바뀌면 금액 단위(소재 ↔ 억)가 달라지므로 금액 초기화 */
  function changeTag(next: string) {
    if (
      currency === "meso" &&
      (next === SOJAE_TAG) !== (tag.trim() === SOJAE_TAG)
    ) {
      setAmountText("");
    }
    setTag(next);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (currency === "meso") {
      // 숫자 + 소수점 하나만 허용, 정수부 6자리 / 소수부 4자리 제한
      const cleaned = e.target.value.replace(/[^\d.]/g, "");
      const [intPart = "", ...rest] = cleaned.split(".");
      const decPart = rest.join("");
      const text =
        cleaned.includes(".")
          ? `${intPart.slice(0, 6)}.${decPart.slice(0, 4)}`
          : intPart.slice(0, 6);
      setAmountText(text);
    } else {
      const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 15);
      setAmountText(addCommas(digits));
    }
  }

  function handleCurrencyChange(c: Currency) {
    if (c === currency) return;
    setCurrency(c);
    setAmountText(""); // 단위(억 ↔ 원)가 달라지므로 금액은 다시 입력
    setTag(c === "meso" ? SOJAE_TAG : ""); // 메소는 사냥이 기본 선택
    setShowCustomTag(false);
  }

  function resetForm() {
    setAmountText("");
    setTag(currency === "meso" ? SOJAE_TAG : "");
    setShowCustomTag(false);
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
      rate: null,
      tag: tag.trim() ? tag.trim() : null,
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
            label: "수입",
            activeClass: "text-emerald-600 dark:text-emerald-400",
          },
          {
            value: "withdraw",
            label: "지출",
            activeClass: "text-red-600 dark:text-red-400",
          },
        ]}
      />

      <SegmentedControl<Currency>
        ariaLabel="통화"
        value={currency}
        onChange={handleCurrencyChange}
        options={[
          { value: "meso", label: "메소" },
          { value: "krw", label: "원" },
        ]}
      />

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          금액{" "}
          {isSojae
            ? "(소재 수 — 1소재 = 1.3억 메소)"
            : currency === "meso"
              ? "(억 메소)"
              : "(원)"}
        </label>
        <input
          ref={amountRef}
          type="text"
          inputMode={currency === "meso" ? "decimal" : "numeric"}
          autoComplete="off"
          placeholder={
            isSojae ? "예: 2" : currency === "meso" ? "예: 3.5" : "예: 50,000"
          }
          value={amountText}
          onChange={handleAmountChange}
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-lg tabular-nums outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
        {currency === "meso" && amount > 0 && (
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            = {formatMeso(amount)}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
          태그
        </label>
        {/* 프리셋 + 최근 사용 태그 — 전부 보이게 여러 줄 랩, 탭 한 번에 자동 입력 */}
        <div className="flex flex-wrap gap-1.5 py-0.5">
          {[
            ...PRESET_TAGS[currency],
            ...tagSuggestions
              .filter((s) => !PRESET_TAGS[currency].includes(s))
              .slice(0, 4),
          ].map((s) => {
            const active = tag.trim() === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  changeTag(active ? "" : s);
                  setShowCustomTag(false);
                }}
                className={`h-8 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-semibold transition active:scale-95 ${
                  active
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {/* 체크 자리를 항상 확보해 선택 시 칩 길이가 변하지 않게 */}
                <span className={active ? "" : "opacity-0"}>✓ </span>
                {s}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setShowCustomTag(!showCustomTag);
              changeTag("");
            }}
            className={`h-8 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-semibold transition active:scale-95 ${
              showCustomTag
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500"
            }`}
          >
            ＋ 직접 입력
          </button>
        </div>
        {showCustomTag && (
          <input
            type="text"
            value={tag}
            onChange={(e) => changeTag(e.target.value.slice(0, MAX_TAG_LENGTH))}
            placeholder="태그 직접 입력"
            autoFocus
            className="mt-2 h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
        )}
      </div>

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
