// 세션 토큰 생성/검증 — AUTH_SECRET 기반 HMAC-SHA256 서명.
// proxy(구 middleware)는 edge 런타임에서도 돌 수 있으므로 Node `crypto` 모듈 대신
// Web Crypto API(globalThis.crypto.subtle)만 사용한다. (Node 18+ / edge 모두 지원)
//
// 토큰 형식: "<만료시각(unix ms)>.<HMAC(base64url)>"
// HMAC 대상 문자열: "session-v1.<만료시각>"

import { cookies } from "next/headers";

/** httpOnly 세션 쿠키 이름 */
export const SESSION_COOKIE = "session";
/** 세션 만료: 30일 (초) */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const PAYLOAD_PREFIX = "session-v1";

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

/** ArrayBuffer → base64url 문자열 (edge 호환: Buffer 미사용) */
function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(sig);
}

/** 상수 시간 문자열 비교 (타이밍 공격 완화) */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 지금부터 30일 뒤 만료되는 세션 토큰을 생성한다. */
export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const sig = await sign(`${PAYLOAD_PREFIX}.${exp}`, getAuthSecret());
  return `${exp}.${sig}`;
}

/**
 * 세션 토큰 검증 — 서명 일치 + 만료 전이면 true.
 * Web Crypto 만 사용하므로 edge(proxy)/Node(route handler) 어디서든 호출 가능.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  let secret: string;
  try {
    secret = getAuthSecret();
  } catch {
    return false;
  }
  const expected = await sign(`${PAYLOAD_PREFIX}.${expStr}`, secret);
  return timingSafeEqual(sig, expected);
}

/**
 * route handler 용: 요청 쿠키의 세션이 유효한지 검사.
 * Next.js 16 에서 cookies() 는 async.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/** 세션 쿠키 공통 옵션 */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
