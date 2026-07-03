# 메소 가계부 (Meso Budget) — 프로젝트 스펙

메이플스토리 메소와 원화(KRW)를 기록하는 가계부.
**비밀번호 하나가 곧 하나의 가계부(계정)** — 비밀번호마다 데이터가 따로 저장된다.
메소와 원화는 서로 자동 환산하지 않고 **각각 별도 잔고로 집계**하며,
둘 사이의 이동은 명시적인 **환전 거래**로만 일어난다.

## 기술 스택
- Next.js 16 (App Router, `src/` 디렉토리, TypeScript, Tailwind CSS 4)
- Supabase (Postgres) — 서버 측에서만 service role 키로 접근 (클라이언트에 키 노출 금지)
- 배포: Vercel
- 패키지 매니저: pnpm

## 인증 (비밀번호 = 계정)
- 아이디 없이 비밀번호(4자 이상)만으로 로그인. `/login` 에서 "로그인" 또는 "새 가계부 만들기"
- 신규 가입은 **가입 코드(`REGISTER_CODE`)** 를 아는 사람만 가능 (틀리면 403).
  `REGISTER_CODE` 를 비워두면 가입 자체가 차단됨 (기존 계정 로그인은 계속 가능)
- 비밀번호 저장: `AUTH_SECRET` 을 pepper 로 쓰는 HMAC-SHA256(`pw-v1.<비밀번호>`)을
  `accounts.password_hmac`(unique) 에 저장. per-account salt(bcrypt류)는 비밀번호만으로
  계정을 찾을 수 없어 사용 불가 — DB 유출만으로는 pepper 없이 대입 공격 불가
- 세션: `<만료ms>.<계정id>.<HMAC>` 토큰을 httpOnly 쿠키(`session`)에 저장 (만료 30일)
- proxy.ts 에서 쿠키 검증, 미인증 시 `/login` redirect (API 는 401)
- 비밀번호 변경: Drawer 메뉴 → `POST /api/auth/password`
- **주의**: `AUTH_SECRET` 을 바꾸면 모든 세션 무효화 + 기존 계정 비밀번호 조회 불가

## 환경변수 (.env.example 참고)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET` (임의의 긴 랜덤 문자열 — 배포 후 유지)
- `REGISTER_CODE` (가입 코드 — 없으면 신규 가입 차단)

## DB 스키마
`supabase/schema.sql` 참고. 테이블: `accounts`, `transactions`(account_id 로 계정 스코프).

## 공용 타입
`src/lib/types.ts` 가 단일 소스. **수정 금지, import 해서 사용.**

## 도메인 규칙
- `type`: `deposit`(수입) | `withdraw`(지출) | `exchange_to_krw`(메소→원 환전) | `exchange_to_meso`(원→메소 환전)
- `currency`: `meso` | `krw` — **환전은 항상 `meso`** (amount = 메소 양)
- `amount`: 양수. meso면 메소 단위 그대로(예: 350000000 = 3.5억 메소), krw면 원.
  입력 UI 에서 메소는 **억 단위 소수**로 입력 (예: 3.5 → 3.5억 메소)
- `rate`: 환전일 때 필수 — **1억 메소당 원화 가격** (기본 1800, 자유 입력). 입출금이면 null
- 환전의 원화 쪽 금액: `krw = amount / 100_000_000 * rate` 반올림 정수 원
- 잔고 반영(`balanceDeltas`): 입출금은 해당 통화만 ±, 환전은 메소·원 양쪽에 반영
- `tag`: 선택, 20자 이하 (메모 대체 — 예: 재획, 보스, 큐브). 환전 폼은 자동으로 "환전".
  재획 태그는 소재 수 입력(1소재 = 1.3억 메소), 새 메소 거래의 기본 태그
- `occurred_at`: UTC ISO 저장. 입력·표시는 항상 **Asia/Seoul(한국 시간) 고정**

## API 계약 (JSON, 로그인/가입 외 모두 쿠키 인증 + 계정 스코프)
- `POST /api/auth/login` — body `{ password, mode?: "login" | "register", code? }` → 200 + 쿠키 / 401(미등록) / 403(가입 코드 불일치) / 409(register 시 중복)
- `POST /api/auth/logout` — 쿠키 제거
- `POST /api/auth/password` — body `{ current, next }` → 200 / 401 / 409(중복)
- `GET /api/transactions?month=YYYY-MM` — Asia/Seoul 기준 그 달의 거래 목록 (occurred_at 내림차순)
- `GET /api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD` — 일 범위(양끝 포함) 조회
- `POST /api/transactions` — body `TransactionInput` → 201 `{ transaction }`
- `PATCH /api/transactions/:id` — 부분 수정 → 200 `{ transaction }`
- `DELETE /api/transactions/:id` — 204
- 유효성 오류는 400 `{ error: string }`

## 화면 (한국어 UI, 모바일 우선)
단일 페이지 `/` + `/login`. 모바일 우선(단일 컬럼, `max-w-md mx-auto`), 다크모드 지원.

### `/` 구성 (위→아래)
1. **헤더**: ☰ (Drawer 열기), 제목 "메소 가계부"
2. **왼쪽 Drawer**: 환전(메소↔원, 방향 토글 + 억 단위 메소 + 시세 + 일시) / 비밀번호 변경 / 로그아웃.
   목록의 환전 거래 "수정"도 이 폼으로 열린다. 마지막 시세는 localStorage 기억
3. **기간 선택**: 월간 / 주간(월~일) / 달력 토글 + ← 라벨 → 이동, 라벨 탭 시 네이티브 피커로 점프
4. **달력 모드**: 태그 필터 칩(전체/#태그) + 월 그리드. 각 날짜에 메소·원 순변화 축약 표시
   ("+3.5억" / "+₩6.3만"), 날짜 탭 → 그 날만 모아보기 (다시 탭 → 해제)
5. **요약 카드**: 메소 / 원화 **각각** 순액 + 증감 (서로 환산하지 않음, 환전은 양쪽 반영)
6. **입력 폼**: 수입/지출 토글, 메소/원 토글, 금액(메소는 억 단위 소수), 태그(프리셋 버튼 + 직접 입력), 일시, 저장
7. **거래 목록**: 날짜별 그룹핑. 수입(초록 +)/지출(빨강 −)/환전(남색 "3.5억 메소 → ₩6,300"),
   시간, #태그 배지, 수정(환전은 Drawer 폼)/삭제(확인 후)

### 숫자 표기 (`src/lib/format.ts`)
- 원: `₩1,234,567`, 축약 `+₩35만`
- 메소: 1억 이상 "12.34억 메소" / 만 단위 "1,234만 메소" / 축약 "+3.5억"

## 파일 소유권 (병렬 작업 경계 — 반드시 준수)
- **backend 에이전트**: `src/app/api/**`, `src/lib/server/**`, `src/proxy.ts`(또는 middleware), `supabase/schema.sql` 확인만
- **frontend 에이전트**: `src/app/page.tsx`, `src/app/login/**`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/format.ts`, `src/lib/client/**`
- 공용(읽기 전용): `src/lib/types.ts`, `docs/SPEC.md`, `.env.example`
