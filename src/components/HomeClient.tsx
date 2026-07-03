"use client";

// 메인 화면 클라이언트 컴포넌트 — 상태 관리 및 API 연동
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/lib/types";
import {
  currentMonth,
  shiftDate,
  todayDateKey,
  weekStartOf,
} from "@/lib/client/time";
import PeriodPicker, { type PeriodMode } from "@/components/PeriodPicker";
import SummaryCards from "@/components/SummaryCards";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";

export default function HomeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(() => currentMonth());
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayDateKey()));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 401 이면 /login 으로 이동하는 fetch 래퍼
  const apiFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const res = await fetch(path, init);
      if (res.status === 401) {
        router.replace("/login");
        throw new Error("unauthorized");
      }
      return res;
    },
    [router],
  );

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const query =
      mode === "month"
        ? `month=${month}`
        : `from=${weekStart}&to=${shiftDate(weekStart, 6)}`;
    try {
      const res = await apiFetch(`/api/transactions?${query}`);
      if (!res.ok) {
        setListError("거래 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { transactions: Transaction[] };
      setTransactions(data.transactions ?? []);
    } catch (err) {
      if ((err as Error)?.message !== "unauthorized") {
        setListError("네트워크 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, mode, month, weekStart]);

  useEffect(() => {
    // setState 를 effect 본문에서 동기 호출하지 않도록 태스크로 미룸
    const t = setTimeout(loadTransactions, 0);
    return () => clearTimeout(t);
  }, [loadTransactions]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 실패해도 로그인 페이지로 이동
    }
    router.replace("/login");
    router.refresh();
  }

  function handleEdit(t: Transaction) {
    setEditing(t);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(t: Transaction) {
    if (!window.confirm("이 거래를 삭제할까요?")) return;
    try {
      const res = await apiFetch(`/api/transactions/${t.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (editing?.id === t.id) setEditing(null);
        setTransactions((prev) => prev.filter((x) => x.id !== t.id));
      } else {
        window.alert("삭제에 실패했습니다.");
      }
    } catch (err) {
      if ((err as Error)?.message !== "unauthorized") {
        window.alert("네트워크 오류가 발생했습니다.");
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4 flex flex-col gap-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">메소 가계부</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 active:scale-95 transition"
        >
          로그아웃
        </button>
      </header>

      {/* 기간 선택 (월간/주간) */}
      <PeriodPicker
        mode={mode}
        month={month}
        weekStart={weekStart}
        onModeChange={setMode}
        onMonthChange={setMonth}
        onWeekChange={setWeekStart}
      />

      {/* 요약 카드 */}
      <SummaryCards transactions={transactions} />

      {/* 입력/수정 폼 */}
      <div ref={formRef} className="scroll-mt-4">
        <TransactionForm
          key={editing ? editing.id : "new"}
          editing={editing}
          apiFetch={apiFetch}
          onSaved={loadTransactions}
          onCancelEdit={() => setEditing(null)}
        />
      </div>

      {/* 거래 목록 */}
      {listError ? (
        <div className="py-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
          <button
            type="button"
            onClick={loadTransactions}
            className="mt-3 h-10 rounded-xl px-4 text-sm font-medium bg-zinc-100 dark:bg-zinc-800"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <TransactionList
          transactions={transactions}
          loading={loading}
          editingId={editing?.id ?? null}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
