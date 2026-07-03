// Supabase service role 클라이언트 — 서버 전용.
// 반드시 요청 시점에 lazy 생성한다. 모듈 top-level 에서 env 를 읽어 throw 하면
// 환경변수가 없는 빌드(예: CI, next build)가 깨지기 때문.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** 요청 시점에 service role 클라이언트를 생성/재사용한다. */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.",
    );
  }

  cached = createClient(url, key, {
    auth: {
      // 서버 전용 클라이언트 — 세션 유지/자동 갱신 불필요
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
