// 태그 프리셋 — 입력 폼(선택 버튼)과 달력(필터 버튼)이 공유하는 단일 소스

import type { Currency } from "@/lib/types";

/** 통화별 기본 태그 — 작은 버튼으로 탭 한 번에 입력 */
export const PRESET_TAGS: Record<Currency, string[]> = {
  meso: ["재획", "보스", "큐브", "스타포스", "아이템"],
  krw: ["현금화", "충전", "아이템", "기타"],
};

/** 재획 태그 전용: 1소재(소울 재획) = 1.3억 메소 — 소재 수로 입력 */
export const SOJAE_TAG = "재획";
export const MESO_PER_SOJAE = 130_000_000;

/** 환전 거래에 자동으로 붙는 태그 */
export const EXCHANGE_TAG = "환전";

/** 달력 필터 등에서 쓰는 전체 프리셋 (중복 제거, 환전 포함) */
export const ALL_PRESET_TAGS: string[] = Array.from(
  new Set([...PRESET_TAGS.meso, ...PRESET_TAGS.krw, EXCHANGE_TAG]),
);
