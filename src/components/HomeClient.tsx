"use client";

// 메인 화면 클라이언트 컴포넌트 — 상태 관리 및 API 연동
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isExchange, type Transaction } from "@/lib/types";
import {
  currentMonth,
  dateKey,
  shiftDate,
  todayDateKey,
  weekStartOf,
} from "@/lib/client/time";
import CalendarView from "@/components/CalendarView";
import Drawer from "@/components/Drawer";
import PeriodPicker, { type PeriodMode } from "@/components/PeriodPicker";
import SummaryCards from "@/components/SummaryCards";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";

export default function HomeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(() => currentMonth());
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayDateKey()));
  // 달력 모드에서 선택한 날짜 (null 이면 월 전체)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 달력 모드 태그 필터 (null 이면 전체)
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 환전 거래 수정 대상 (Drawer 의 환전 폼으로 열림)
  const [editingExchange, setEditingExchange] = useState<Transaction | null>(
    null,
  );
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
    // 월간/달력 모드는 월 범위, 주간 모드는 주 범위로 조회
    const query =
      mode === "week"
        ? `from=${weekStart}&to=${shiftDate(weekStart, 6)}`
        : `month=${month}`;
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

  // 최근 사용 태그 (입력 폼 칩)
  const tagSuggestions = Array.from(
    new Set(
      transactions
        .map((t) => t.tag)
        .filter((tag): tag is string => tag !== null),
    ),
  ).slice(0, 8);

  // 달력 모드: 태그 필터 → 날짜 선택 순으로 좁힌다
  const tagFiltered =
    mode === "calendar" && selectedTag
      ? transactions.filter((t) => t.tag === selectedTag)
      : transactions;
  const visibleTransactions =
    mode === "calendar" && selectedDate
      ? tagFiltered.filter((t) => dateKey(t.occurred_at) === selectedDate)
      : tagFiltered;

  // 달력 태그 필터 후보 (이 달에 실제로 쓰인 태그)
  const monthTags = Array.from(
    new Set(
      transactions
        .map((t) => t.tag)
        .filter((tag): tag is string => tag !== null),
    ),
  );

  function handleEdit(t: Transaction) {
    if (isExchange(t.type)) {
      // 환전 거래는 Drawer 의 환전 폼으로 수정
      setEditingExchange(t);
      setDrawerOpen(true);
      return;
    }
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
        if (editingExchange?.id === t.id) setEditingExchange(null);
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
      <header className="flex items-center gap-2">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setDrawerOpen(true)}
          className="h-10 w-10 rounded-xl text-xl text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 active:scale-95 transition"
        >
          ☰
        </button>
        <h1 className="text-xl font-bold tracking-tight">메소 가계부</h1>
      </header>

      {/* 왼쪽 Drawer: 환전 / 비밀번호 변경 / 로그아웃 */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingExchange(null);
        }}
        editingExchange={editingExchange}
        apiFetch={apiFetch}
        onSaved={() => {
          setEditingExchange(null);
          loadTransactions();
        }}
        onLogout={handleLogout}
      />

      {/* 기간 선택 (월간/주간/달력) */}
      <PeriodPicker
        mode={mode}
        month={month}
        weekStart={weekStart}
        onModeChange={(m) => {
          setMode(m);
          setSelectedDate(null);
          setSelectedTag(null);
        }}
        onMonthChange={(m) => {
          setMonth(m);
          setSelectedDate(null);
          setSelectedTag(null);
        }}
        onWeekChange={setWeekStart}
      />

      {/* 달력 모드: 태그 필터 + 달력 */}
      {mode === "calendar" && (
        <>
          {monthTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`h-8 rounded-full px-3 text-sm font-medium transition active:scale-95 ${
                  selectedTag === null
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                전체
              </button>
              {monthTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedTag(selectedTag === tag ? null : tag)
                  }
                  className={`h-8 rounded-full px-3 text-sm font-medium transition active:scale-95 ${
                    selectedTag === tag
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
          <CalendarView
            month={month}
            transactions={tagFiltered}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </>
      )}

      {/* 요약 카드 — 메소/원화 각각 집계 (필터 반영) */}
      <SummaryCards transactions={visibleTransactions} />

      {/* 입력/수정 폼 */}
      <div ref={formRef} className="scroll-mt-4">
        <TransactionForm
          key={editing ? editing.id : "new"}
          editing={editing}
          tagSuggestions={tagSuggestions}
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
          transactions={visibleTransactions}
          loading={loading}
          editingId={editing?.id ?? editingExchange?.id ?? null}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
