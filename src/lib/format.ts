// 숫자 표기 유틸 — docs/SPEC.md "숫자 표기" 규칙
import { MESO_UNIT } from "@/lib/types";

/** 원화 표기: ₩1,234,567 (음수는 -₩1,234,567) */
export function formatKrw(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}₩${Math.abs(rounded).toLocaleString("ko-KR")}`;
}

/** 부호 명시 원화 표기: +₩1,234 / -₩1,234 */
export function formatSignedKrw(n: number): string {
  const rounded = Math.round(n);
  if (rounded > 0) return `+${formatKrw(rounded)}`;
  return formatKrw(rounded);
}

/**
 * 메소 표기:
 * - 1억 이상: "12.34억 메소" (소수 둘째 자리까지, 불필요한 0 제거)
 * - 1만 이상: "1,234만 메소"
 * - 1만 미만: "1,234 메소"
 */
export function formatMeso(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= MESO_UNIT) {
    const eok = Math.round((abs / MESO_UNIT) * 100) / 100;
    return `${sign}${eok.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억 메소`;
  }
  if (abs >= 10_000) {
    const man = Math.round((abs / 10_000) * 10) / 10;
    return `${sign}${man.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만 메소`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")} 메소`;
}

/** 부호 명시 메소 표기: +3.5억 메소 */
export function formatSignedMeso(amount: number): string {
  if (amount > 0) return `+${formatMeso(amount)}`;
  return formatMeso(amount);
}

/** 축약 숫자: 1억 이상 "1.2억" / 1만 이상 "35만" / 그 외 "3,500" (부호 포함) */
function compactNumber(n: number): { sign: string; text: string } {
  const rounded = Math.round(n);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  if (abs >= 100_000_000) {
    const eok = Math.round((abs / 100_000_000) * 10) / 10;
    return { sign, text: `${eok.toLocaleString("ko-KR")}억` };
  }
  if (abs >= 10_000) {
    return { sign, text: `${Math.round(abs / 10_000).toLocaleString("ko-KR")}만` };
  }
  return { sign, text: abs.toLocaleString("ko-KR") };
}

/** 달력 셀용 축약 원화 표기: "+₩35만" (메소와 구분되게 ₩ 표기) */
export function formatCompactKrw(n: number): string {
  const { sign, text } = compactNumber(n);
  return `${sign}₩${text}`;
}

/** 달력 셀용 축약 메소 표기: "+3.5억" */
export function formatCompactMeso(n: number): string {
  const { sign, text } = compactNumber(n);
  return `${sign}${text}`;
}

/** 정수 문자열에 천단위 콤마 삽입 (입력 폼 표시용) */
export function addCommas(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 콤마 등 숫자 외 문자를 제거하고 숫자로 파싱 (빈 값은 0) */
export function parseDigits(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}
