"use client";

// 로그인 페이지 — 비밀번호 하나로 로그인 (1인용)
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      if (res.status === 401) {
        setError("비밀번호가 올바르지 않습니다.");
      } else {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-card p-6 shadow-sm border border-black/5 dark:border-white/10 flex flex-col gap-4"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">메소 가계부</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              비밀번호를 입력해 주세요
            </p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="h-12 w-full rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-base font-semibold disabled:opacity-40 active:scale-[0.99] transition"
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
