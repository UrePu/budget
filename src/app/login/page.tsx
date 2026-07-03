"use client";

// 로그인 페이지 — 비밀번호가 곧 계정. 비밀번호마다 장부가 따로 저장된다.
// "로그인": 기존 비밀번호로 입장.
// "새 가계부 만들기": 가입 코드(REGISTER_CODE)를 아는 사람만 새 계정 생성 가능.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"login" | "register" | null>(null);

  async function submit(mode: "login" | "register") {
    if (!password || loading) return;
    setLoading(mode);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { password, mode, code } : { password, mode },
        ),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      let message = "실패했습니다. 잠시 후 다시 시도해 주세요.";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // JSON 아님 — 기본 메시지 사용
      }
      setError(message);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit("login");
          }}
          className="rounded-2xl bg-card p-6 shadow-sm border border-black/5 dark:border-white/10 flex flex-col gap-4"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">메소 가계부</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              비밀번호마다 가계부가 따로 저장됩니다
            </p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="비밀번호 (4자 이상)"
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
            disabled={loading !== null || !password}
            className="h-12 w-full rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-base font-semibold disabled:opacity-40 active:scale-[0.99] transition"
          >
            {loading === "login" ? "확인 중..." : "로그인"}
          </button>

          {!showRegister ? (
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="text-sm text-zinc-500 dark:text-zinc-400 underline underline-offset-2"
            >
              새 가계부 만들기 (가입 코드 필요)
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder="가입 코드"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              />
              <button
                type="button"
                disabled={loading !== null || !password || !code}
                onClick={() => submit("register")}
                className="h-12 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-base font-semibold disabled:opacity-40 active:scale-[0.99] transition"
              >
                {loading === "register"
                  ? "만드는 중..."
                  : "이 비밀번호로 새 가계부 만들기"}
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
