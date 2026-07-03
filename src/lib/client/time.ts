// 시간 유틸 — 한국 시간(Asia/Seoul) 고정, Intl.DateTimeFormat 기반 (외부 라이브러리 없음)
// datetime-local(YYYY-MM-DDTHH:mm) ↔ UTC ISO 변환, 표시 문자열 생성

/** 앱 전체 표시/입력 기준 시간대 (고정) */
const KST = "Asia/Seoul";

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

let kstFormatter: Intl.DateTimeFormat | null = null;

function getKstFormatter(): Intl.DateTimeFormat {
  if (!kstFormatter) {
    kstFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: KST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }
  return kstFormatter;
}

/** 주어진 시각(Date)을 한국 시간 벽시계 값으로 분해 */
function wallClockKst(date: Date): WallClock {
  const parts = getKstFormatter().formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC 시각(ms)에서의 한국 시간 오프셋(ms). Asia/Seoul → +9h */
function kstOffsetMs(utcMs: number): number {
  const w = wallClockKst(new Date(utcMs));
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - utcMs;
}

/** (a) 현재 한국 시각 → datetime-local 값 (YYYY-MM-DDTHH:mm) */
export function nowLocalInput(): string {
  return utcIsoToLocalInput(new Date().toISOString());
}

/** UTC ISO → 한국 시간 datetime-local 값 (YYYY-MM-DDTHH:mm) */
export function utcIsoToLocalInput(iso: string): string {
  const w = wallClockKst(new Date(iso));
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * (b) datetime-local 값(한국 시간 벽시계) → UTC ISO 문자열
 * 벽시계 시각을 UTC 로 가정한 뒤 실제 오프셋으로 보정
 */
export function localInputToUtcIso(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error(`잘못된 datetime-local 값: ${value}`);
  const wallUtc = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  );
  const utc = wallUtc - kstOffsetMs(wallUtc);
  return new Date(utc).toISOString();
}

/** (c) UTC ISO → 한국 시간 시각만 "14:05" */
export function formatTime(iso: string): string {
  const w = wallClockKst(new Date(iso));
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** UTC ISO → 한국 시간 날짜 그룹 키 "YYYY-MM-DD" */
export function dateKey(iso: string): string {
  const w = wallClockKst(new Date(iso));
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜 키("YYYY-MM-DD") → 그룹 제목 "7월 3일 (금)" */
export function formatDateHeading(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS_KO[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${mo}월 ${d}일 (${weekday})`;
}

/** 한국 시간 기준 현재 달 "YYYY-MM" */
export function currentMonth(): string {
  const w = wallClockKst(new Date());
  return `${w.year}-${pad(w.month)}`;
}

/** "YYYY-MM" → "2026년 7월" */
export function formatMonthLabel(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  return `${y}년 ${mo}월`;
}

/** "YYYY-MM" 에 delta 개월 더하기 */
export function shiftMonth(month: string, delta: number): string {
  const [y, mo] = month.split("-").map(Number);
  const total = y * 12 + (mo - 1) + delta;
  const ny = Math.floor(total / 12);
  const nmo = (total % 12) + 1;
  return `${ny}-${pad(nmo)}`;
}

/** 한국 시간 기준 오늘 날짜 "YYYY-MM-DD" */
export function todayDateKey(): string {
  const w = wallClockKst(new Date());
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** "YYYY-MM-DD" 에 delta 일 더하기 */
export function shiftDate(dateKey: string, delta: number): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + delta));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 그 날짜가 속한 주의 시작일(월요일) "YYYY-MM-DD" */
export function weekStartOf(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=일 ~ 6=토
  return shiftDate(dateKey, dow === 0 ? -6 : 1 - dow);
}

/** 주 시작일(월요일) → "6월 29일 ~ 7월 5일" (연도가 다르면 뒤쪽에 연도 표기) */
export function formatWeekLabel(weekStart: string): string {
  const end = shiftDate(weekStart, 6);
  const [sy, sm, sd] = weekStart.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startLabel = `${sm}월 ${sd}일`;
  const endLabel =
    sy !== ey ? `${ey}년 ${em}월 ${ed}일` : `${em}월 ${ed}일`;
  return `${startLabel} ~ ${endLabel}`;
}
