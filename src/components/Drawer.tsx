"use client";

// 왼쪽 슬라이드 Drawer — 메뉴(환전 / 비밀번호 변경 / 로그아웃)
// 환전: 메소↔원 잔고를 실제로 이동시키는 거래(exchange_to_krw / exchange_to_meso)를
// 생성·수정한다. 목록의 환전 거래 "수정"도 이 폼으로 열린다.

import { useEffect, useState } from "react";
import {
  DEFAULT_RATE,
  MESO_UNIT,
  type Transaction,
  type TxType,
} from "@/lib/types";
import { formatKrw, formatMeso } from "@/lib/format";
import {
  localInputToUtcIso,
  nowLocalInput,
  utcIsoToLocalInput,
} from "@/lib/client/time";
import SegmentedControl from "@/components/SegmentedControl";

const LAST_RATE_KEY = "lastRate";

type View = "menu" | "exchange" | "password";
type ExchangeType = "exchange_to_krw" | "exchange_to_meso";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 환전 거래 수정 모드로 열기 (null 이면 메뉴부터) */
  editingExchange: Transaction | null;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** 환전 저장/삭제 후 목록 갱신 */
  onSaved: () => void;
  onLogout: () => void;
}

export default function Drawer({
  open,
  onClose,
  editingExchange,
  apiFetch,
  onSaved,
  onLogout,
}: Props) {
  const [view, setView] = useState<View>("menu");

  // 열릴 때마다 시작 화면 결정 (환전 수정이면 바로 환전 폼)
  useEffect(() => {
    if (open) setView(editingExchange ? "exchange" : "menu");
  }, [open, editingExchange]);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* 패널 */}
      <aside
        role="dialog"
        aria-label="메뉴"
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-card shadow-xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-3">
          {view === "menu" ? (
            <h2 className="text-base font-bold">메뉴</h2>
          ) : (
            <button
              type="button"
              onClick={() => setView("menu")}
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
            >
              ← 메뉴
            </button>
          )}
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="h-9 w-9 rounded-lg text-lg text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {view === "menu" && (
            <nav className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setView("exchange")}
                className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 text-left text-base font-semibold active:scale-[0.99] transition"
              >
                💱 환전 (메소 ↔ 원)
              </button>
              <button
                type="button"
                onClick={() => setView("password")}
                className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 text-left text-base font-semibold active:scale-[0.99] transition"
              >
                🔑 비밀번호 변경
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="h-12 rounded-xl px-4 text-left text-base font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 active:scale-[0.99] transition"
              >
                로그아웃
              </button>
            </nav>
          )}

          {view === "exchange" && (
            <ExchangeForm
              key={editingExchange ? editingExchange.id : "new"}
              editing={editingExchange}
              apiFetch={apiFetch}
              onSaved={() => {
                onSaved();
                onClose();
              }}
            />
          )}

          {view === "password" && <PasswordForm apiFetch={apiFetch} />}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// 환전 폼
// ---------------------------------------------------------------------------

function ExchangeForm({
  editing,
  apiFetch,
  onSaved,
}: {
  editing: Transaction | null;
  apiFetch: Props["apiFetch"];
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<ExchangeType>(
    (editing?.type as ExchangeType) ?? "exchange_to_krw",
  );
  const [eokText, setEokText] = useState(() =>
    editing
      ? String(Math.round((editing.amount / MESO_UNIT) * 10_000) / 10_000)
      : "",
  );
  const [rateText, setRateText] = useState(() =>
    editing?.rate != null ? String(editing.rate) : String(DEFAULT_RATE),
  );
  const [occurredLocal, setOccurredLocal] = useState(() =>
    editing ? utcIsoToLocalInput(editing.occurred_at) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    try {
      const saved = localStorage.getItem(LAST_RATE_KEY);
      if (saved && Number(saved) > 0) setRateText(saved);
    } catch {
      // localStorage 접근 불가 시 기본값 유지
    }
    setOccurredLocal((prev) => prev || nowLocalInput());
  }, [editing]);

  const amount = Math.round((Number(eokText) || 0) * MESO_UNIT);
  const rateNum = Number(rateText.replace(/,/g, ""));
  const rate = Number.isFinite(rateNum) && rateNum > 0 ? rateNum : 0;
  const krw = amount > 0 && rate > 0 ? Math.round((amount / MESO_UNIT) * rate) : 0;

  function handleEokChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/[^\d.]/g, "");
    const [intPart = "", ...rest] = cleaned.split(".");
    const decPart = rest.join("");
    setEokText(
      cleaned.includes(".")
        ? `${intPart.slice(0, 6)}.${decPart.slice(0, 4)}`
        : intPart.slice(0, 6),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (amount <= 0) return setError("메소 양을 입력해 주세요.");
    if (rate <= 0) return setError("시세(1억당 원)를 입력해 주세요.");
    if (!occurredLocal) return setError("일시를 입력해 주세요.");

    let occurredAtIso: string;
    try {
      occurredAtIso = localInputToUtcIso(occurredLocal);
    } catch {
      return setError("일시 형식이 올바르지 않습니다.");
    }

    const input = {
      occurred_at: occurredAtIso,
      type: direction as TxType,
      currency: "meso" as const,
      amount,
      rate,
      tag: "환전",
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
          // JSON 아님
        }
        setError(message);
        return;
      }

      try {
        localStorage.setItem(LAST_RATE_KEY, String(rate));
      } catch {
        // 저장 실패 무시
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

  const toKrwDirection = direction === "exchange_to_krw";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        {editing ? "환전 수정" : "환전"}
      </h3>

      <SegmentedControl<ExchangeType>
        ariaLabel="환전 방향"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "exchange_to_krw", label: "메소 → 원" },
          { value: "exchange_to_meso", label: "원 → 메소" },
        ]}
      />

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          메소 양 (억 메소)
        </label>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="예: 3.5"
          value={eokText}
          onChange={handleEokChange}
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-lg tabular-nums outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>

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
          onChange={(e) =>
            setRateText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))
          }
          className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base tabular-nums outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>

      {amount > 0 && krw > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">
          {toKrwDirection
            ? `${formatMeso(amount)} → ${formatKrw(krw)}`
            : `${formatKrw(krw)} → ${formatMeso(amount)}`}
        </p>
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

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-12 w-full rounded-xl bg-indigo-600 dark:bg-indigo-500 text-base font-bold text-white disabled:opacity-40 active:scale-[0.99] transition"
      >
        {saving ? "저장 중..." : editing ? "환전 수정 저장" : "환전 저장"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 비밀번호 변경 폼
// ---------------------------------------------------------------------------

function PasswordForm({ apiFetch }: { apiFetch: Props["apiFetch"] }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (next.length < 4) return setError("새 비밀번호는 4자 이상이어야 합니다.");
    if (next !== confirm) return setError("새 비밀번호가 서로 다릅니다.");

    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const res = await apiFetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      if (!res.ok) {
        let message = "비밀번호 변경에 실패했습니다.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // JSON 아님
        }
        setError(message);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if ((err as Error)?.message !== "unauthorized") {
        setError("네트워크 오류가 발생했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        비밀번호 변경
      </h3>
      <input
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="현재 비밀번호"
        autoComplete="current-password"
        className={inputClass}
      />
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="새 비밀번호 (4자 이상)"
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="새 비밀번호 확인"
        autoComplete="new-password"
        className={inputClass}
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          비밀번호가 변경되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !current || !next || !confirm}
        className="h-12 w-full rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-base font-bold disabled:opacity-40 active:scale-[0.99] transition"
      >
        {saving ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
