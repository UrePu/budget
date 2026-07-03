# 메소 가계부 (Meso Budget) — 프로젝트 스펙

개인용(1인) 가계부. 메이플스토리 메소와 원화(KRW)를 함께 기록한다.
메소는 **1억 메소당 1600~2000원** 사이의 가변 시세로 원화 환산된다.

## 기술 스택
- Next.js 16 (App Router, `src/` 디렉토리, TypeScript, Tailwind CSS 4)
- Supabase (Postgres) — 서버 측에서만 service role 키로 접근 (클라이언트에 키 노출 금지)
- 배포: Vercel
- 패키지 매니저: pnpm

## 인증 (1인용 간단 방식)
- 환경변수 `APP_PASSWORD` 와 비교하는 로그인 폼 (`/login`)
- 성공 시 `AUTH_SECRET` 으로 HMAC 서명한 토큰을 httpOnly 쿠키(`session`)에 저장 (만료 30일)
- 미들웨어(또는 proxy.ts)에서 쿠키 검증, 미인증 시 `/login` 으로 redirect
- API 라우트도 동일하게 쿠키 검증 (미인증 401)

## 환경변수 (.env.example 참고)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PASSWORD`
- `AUTH_SECRET` (임의의 긴 랜덤 문자열)

## DB 스키마
`supabase/schema.sql` 참고. 테이블 하나: `transactions`.

## 공용 타입
`src/lib/types.ts` 가 단일 소스. **수정 금지, import 해서 사용.**

## 도메인 규칙
- `type`: `deposit`(입금) | `withdraw`(출금)
- `currency`: `meso` | `krw`
- `amount`: 양수. meso면 메소 단위 그대로(예: 350000000 = 3.5억 메소), krw면 원
- `rate`: currency가 meso일 때 필수 — **1억 메소당 원화 가격** (기본 1800, 통상 1600~2000, 자유 입력 허용). krw면 null
- 원화 환산: `krw = amount / 100_000_000 * rate` (meso인 경우), 반올림하여 정수 원
- `occurred_at`: UTC ISO 저장. 입력·표시는 항상 **Asia/Seoul(한국 시간) 고정**. 입력 폼의 일시는 기본값이 현재 시각이며 자유롭게 수정 가능, 수정한 값이 DB에 저장됨

## API 계약 (모두 쿠키 인증 필요, JSON)
- `POST /api/auth/login` — body `{ password }` → 200 + 쿠키 설정 / 401
- `POST /api/auth/logout` — 쿠키 제거
- `GET /api/transactions?month=YYYY-MM` — Asia/Seoul 기준 그 달의 거래 목록 (occurred_at 내림차순). 응답 `{ transactions: Transaction[] }`
- `POST /api/transactions` — body `TransactionInput` → 201 `{ transaction }`
- `PATCH /api/transactions/:id` — 부분 수정 → 200 `{ transaction }`
- `DELETE /api/transactions/:id` — 204
- 유효성 오류는 400 `{ error: string }`

## 화면 (한국어 UI, 모바일 우선)
단일 페이지 `/` + `/login`. 모바일 우선(단일 컬럼, `max-w-md mx-auto`), 데스크톱에서도 무난하게. 다크모드 지원.

### `/` 구성 (위→아래)
1. **헤더**: 제목 "메소 가계부", 로그아웃 버튼
2. **월 선택**: ← 2026년 7월 → (기본 이번 달)
3. **요약 카드**: 해당 월의 입금 합계 / 출금 합계 / 순액 — 모두 원화 환산 기준. 메소 합계도 별도 표기 (예: "+3.5억 메소")
4. **입력 폼** (핵심 UX, 터치 친화적 큰 버튼):
   - 입금/출금 토글 (segmented control)
   - 메소/원 토글 (segmented control)
   - 금액 입력 (inputmode=numeric, 천단위 콤마 자동 표시; 메소일 땐 아래에 "= 3.5억 메소" 및 환산 원화 실시간 표시)
   - 시세 입력 (메소일 때만 표시): 1억당 원, 기본값 1800, 마지막 사용값 localStorage 기억
   - 일시: datetime-local, 기본값 = 현재 시각(한국 시간), 자유롭게 수정 가능 (시간대 선택 기능 없음)
   - 메모 (선택)
   - 저장 버튼 (저장 중 disabled, 성공 시 폼 리셋 + 목록 갱신)
5. **거래 목록**: 날짜별 그룹핑. 각 항목: 입금(초록 +)/출금(빨강 −), 금액(메소면 "3.5억 메소" + 환산 원화 병기), 시간(한국 시간 기준), 메모, 길게 보기/삭제(확인 후), 수정(폼에 불러오기)

### 숫자 표기
- 원: `₩1,234,567`
- 메소: 1억 이상이면 "12.34억 메소", 미만이면 "1,234만 메소" / 만 미만은 콤마 숫자. 목록/요약 공통 유틸 사용 (`src/lib/format.ts`)

## 파일 소유권 (병렬 작업 경계 — 반드시 준수)
- **backend 에이전트**: `src/app/api/**`, `src/lib/server/**`, `src/proxy.ts`(또는 middleware), `supabase/schema.sql` 확인만
- **frontend 에이전트**: `src/app/page.tsx`, `src/app/login/**`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/format.ts`, `src/lib/client/**`
- 공용(읽기 전용): `src/lib/types.ts`, `docs/SPEC.md`, `.env.example`
